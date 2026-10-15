using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Medical.Api.Modules.HospitalInformation;
using Medical.Api.Modules.Authorizations;

namespace Medical.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class HospitalInformationController : ControllerBase
    {
        private readonly IHospitalInformationRepository _repository;

        public HospitalInformationController(IHospitalInformationRepository repository)
        {
            _repository = repository;
        }

        [HttpGet]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<IEnumerable<HospitalInformation>>> GetAll()
        {
            return Ok(await _repository.GetAllAsync());
        }

        [HttpGet("{id:long}")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<ActionResult<HospitalInformation>> GetById(long id)
        {
            var dept = await _repository.GetByIdAsync(id);
            if (dept is null)
                return NotFound();

            return Ok(dept);
        }

        [HttpGet("paginated")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetPaginated(int pageNumber = 1, int pageSize = 10)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 10;
            return Ok(await _repository.GetPaginatedAsync(pageNumber, pageSize));
        }

        [HttpGet("nearby")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radius = 10)
        {
            if (radius <= 0) radius = 10;
            var result = await _repository.GetNearbyAsync(lat, lng, radius);
            return Ok(result);
        }

        [HttpGet("geocode")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> Geocode([FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { found = false, message = "Address parameter is required." });

            var (found, lat, lng, displayName) = await GeocodeAddressAsync(address.Trim());
            if (!found)
                return Ok(new { found = false, message = "Could not find coordinates for the given address." });

            return Ok(new
            {
                found = true,
                address = address.Trim(),
                latitude = lat,
                longitude = lng,
                displayName
            });
        }

        [HttpGet("nearby-by-address")]
        [Authorize(Policy = AppPolicies.AllAuthenticatedUsers)]
        public async Task<IActionResult> GetNearbyByAddress([FromQuery] string address, [FromQuery] double radius = 0)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { found = false, message = "Address parameter is required." });

            var (found, lat, lng, displayName) = await GeocodeAddressAsync(address.Trim());
            if (!found)
            {
                return Ok(new
                {
                    found = false,
                    address = address.Trim(),
                    message = "Could not locate address on OpenStreetMap.",
                    hospitals = Array.Empty<HospitalInformation>()
                });
            }

            // If radius is 0 or negative, return all hospitals with distance calculated
            var hospitals = await _repository.GetNearbyAsync(lat, lng, radius);

            return Ok(new
            {
                found = true,
                address = address.Trim(),
                latitude = lat,
                longitude = lng,
                displayName,
                hospitals
            });
        }

        private static readonly System.Net.Http.HttpClient _httpClient = CreateHttpClient();
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (bool, double, double, string)> _geocodeCache = new(StringComparer.OrdinalIgnoreCase);

        private static System.Net.Http.HttpClient CreateHttpClient()
        {
            var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("MedicalBookingApp/1.0 (contact@medicalbooking.local)");
            return client;
        }

        private static async Task<(bool found, double lat, double lng, string displayName)> GeocodeAddressAsync(string address)
        {
            if (string.IsNullOrWhiteSpace(address)) return (false, 0, 0, string.Empty);

            string key = address.Trim();
            if (_geocodeCache.TryGetValue(key, out var cached))
            {
                return cached;
            }

            try
            {
                string url = $"https://nominatim.openstreetmap.org/search?format=json&q={Uri.EscapeDataString(key)}&limit=1";
                using var response = await _httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    string json = await response.Content.ReadAsStringAsync();
                    using var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                    {
                        var first = doc.RootElement[0];
                        if (first.TryGetProperty("lat", out var latProp) &&
                            first.TryGetProperty("lon", out var lonProp) &&
                            double.TryParse(latProp.GetString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lat) &&
                            double.TryParse(lonProp.GetString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double lng))
                        {
                            string displayName = first.TryGetProperty("display_name", out var dn) ? dn.GetString() ?? "" : "";
                            var res = (true, lat, lng, displayName);
                            _geocodeCache[key] = res;
                            return res;
                        }
                    }
                }
            }
            catch
            {
                // Silently handle network / timeout
            }

            return (false, 0, 0, string.Empty);
        }

        [HttpPost]
        [Authorize(Policy = AppPolicies.AdminOnly)]
        public async Task<ActionResult<HospitalInformation>> Create(HospitalInformation hospitalInformation)
        {
            await _repository.AddAsync(hospitalInformation);
            return CreatedAtAction(nameof(GetById), new { id = hospitalInformation.HospitalId }, hospitalInformation);
        }

        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, HospitalInformation hospitalInformation)
        {
            if (hospitalInformation.HospitalId == 0)
                hospitalInformation.HospitalId = id;

            if (id != hospitalInformation.HospitalId)
                return BadRequest("Route id does not match hospital_id in request body.");

            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.UpdateAsync(hospitalInformation);
            return NoContent();
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing is null)
                return NotFound();

            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }
}

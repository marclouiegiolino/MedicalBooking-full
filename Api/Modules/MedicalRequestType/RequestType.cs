using System.Text.Json.Serialization;

namespace Medical.Api.Modules.MedicalRequestType
{
    public sealed class RequestType
    {
        private long?   _requestTypeId;
        private string? _requestName;

        public RequestType() { }

        public RequestType(long requestTypeId, string requestName)
        {
            RequestTypeId = requestTypeId;
            RequestName   = requestName;
        }

        [JsonPropertyName("request_type_id")]
        [JsonPropertyOrder(1)]
        public long RequestTypeId
        {
            get => _requestTypeId ?? 0L;
            set => _requestTypeId = value;
        }

        [JsonPropertyName("request_name")]
        [JsonPropertyOrder(2)]
        public string RequestName
        {
            get => _requestName ?? string.Empty;
            set => _requestName = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }
    }
}
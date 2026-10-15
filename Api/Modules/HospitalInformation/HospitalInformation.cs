using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.HospitalInformation
{
    public sealed class HospitalInformation
    {
        private long? _hospitalId;
        private string? _hospitalName;
        private string? _address;
        private string? _phoneNumber;
        private string? _email;
        private string? _logoPath;
        private string? _updatedAt;
        private double? _latitude;
        private double? _longitude;
        private double? _serviceRadius;

        public HospitalInformation() { }

        public HospitalInformation(long hospitalId, string hospitalName, string address, string phoneNumber,
            string email, string logoPath, string updatedAt, double latitude, double longitude, double serviceRadius)
        {
            HospitalId = hospitalId;
            HospitalName = hospitalName;
            Address = address;
            PhoneNumber = phoneNumber;
            Email = email;
            LogoPath = logoPath;
            UpdatedAt = updatedAt;
            Latitude = latitude;
            Longitude = longitude;
            ServiceRadius = serviceRadius;
        }

        [JsonPropertyName("hospital_id")]
        [JsonPropertyOrder(1)]
        public long HospitalId
        {
            get => _hospitalId ?? 0L;
            set => _hospitalId = value;
        }

        [JsonPropertyName("hospital_name")]
        [JsonPropertyOrder(2)]
        public string HospitalName
        {
            get => _hospitalName ?? string.Empty;
            set => _hospitalName = NormalizeSpaces(value);
        }

        [JsonPropertyName("address")]
        [JsonPropertyOrder(3)]
        public string Address
        {
            get => _address ?? string.Empty;
            set => _address = NormalizeSpaces(value);
        }

        [JsonPropertyName("phone_number")]
        [JsonPropertyOrder(4)]
        public string PhoneNumber
        {
            get => _phoneNumber ?? string.Empty;
            set => _phoneNumber = NormalizeSpaces(value);
        }

        [JsonPropertyName("email")]
        [JsonPropertyOrder(5)]
        public string Email
        {
            get => _email ?? string.Empty;
            set => _email = NormalizeSpaces(value);
        }

        [JsonPropertyName("logo_path")]
        [JsonPropertyOrder(6)]
        public string LogoPath
        {
            get => _logoPath ?? string.Empty;
            set => _logoPath = NormalizeSpaces(value);
        }

        [JsonPropertyName("updated_at")]
        [JsonPropertyOrder(7)]
        public string UpdatedAt
        {
            get => _updatedAt ?? string.Empty;
            set => _updatedAt = value;
        }

        [JsonPropertyName("latitude")]
        [JsonPropertyOrder(8)]
        public double Latitude
        {
            get => _latitude ?? 0.0;
            set => _latitude = value;
        }

        [JsonPropertyName("longitude")]
        [JsonPropertyOrder(9)]
        public double Longitude
        {
            get => _longitude ?? 0.0;
            set => _longitude = value;
        }

        [JsonPropertyName("service_radius")]
        [JsonPropertyOrder(10)]
        public double ServiceRadius
        {
            get => _serviceRadius ?? 0.0;
            set => _serviceRadius = value;
        }

        [JsonPropertyName("distance_km")]
        [JsonPropertyOrder(11)]
        public double? DistanceKm { get; set; }

        [JsonPropertyName("is_within_service_radius")]
        [JsonPropertyOrder(12)]
        public bool? IsWithinServiceRadius { get; set; }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}
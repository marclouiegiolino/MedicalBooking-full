using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Specialty
{
    public sealed class Specialty
    {
        private long? _specialtyId;
        private string? _specialtyName = string.Empty;

        public Specialty() { }

        public Specialty(long specialtyId, string specialtyName)
        {
            SpecialtyId = specialtyId;
            SpecialtyName = specialtyName;
        }

        [JsonPropertyName("specialty_id")]
        [JsonPropertyOrder(1)]
        public long SpecialtyId
        {
            get => _specialtyId ?? 0L;
            set => _specialtyId = value;
        }

        [JsonPropertyName("specialty_name")]
        [JsonPropertyOrder(2)]
        public string SpecialtyName
        {
            get => _specialtyName ?? string.Empty;
            set => _specialtyName = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}
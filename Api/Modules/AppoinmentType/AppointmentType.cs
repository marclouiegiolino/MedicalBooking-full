using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.AppointmentType
{
    public sealed class AppointmentType
    {
        private long?   _appointmentTypeId;
        private string? _appointmentName;

        public AppointmentType() { }

        public AppointmentType(long appointmentTypeId, string appointmentName)
        {
            AppointmentTypeId = appointmentTypeId;
            AppointmentName   = appointmentName;
        }

        [JsonPropertyName("appointment_type_id")]
        [JsonPropertyOrder(1)]
        public long AppointmentTypeId
        {
            get => _appointmentTypeId ?? 0L;
            set => _appointmentTypeId = value;
        }

        [JsonPropertyName("appointment_name")]
        [JsonPropertyOrder(2)]
        public string AppointmentName
        {
            get => _appointmentName ?? string.Empty;
            set => _appointmentName = NormalizeSpaces(value);
        }

        private static string NormalizeSpaces(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return string.Empty;

            return System.Text.RegularExpressions.Regex.Replace(input.Trim(), @"\s+", " ");
        }
    }
}
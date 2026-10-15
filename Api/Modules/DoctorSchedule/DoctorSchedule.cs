using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.DoctorSchedule
{
    public sealed class DoctorSchedule : IEquatable<DoctorSchedule>
    {
        private long?   _scheduleId;
        private long?   _doctorId;
        private string? _dayOfWeek;
        private string? _startTime;
        private string? _endTime;
        private int?    _slotDuration;
        private int?    _maxAppointments;
        private bool    _isActive;

        public DoctorSchedule() { }

        public DoctorSchedule(long scheduleId, 
                                long doctorId, 
                                string dayOfWeek, 
                                string startTime,
                                string endTime, 
                                int slotDuration, 
                                int maxAppointments,
                                bool isActive)
        {
            ScheduleId      = scheduleId;
            DoctorId        = doctorId;
            DayOfWeek       = dayOfWeek;
            StartTime       = startTime;
            EndTime         = endTime;
            SlotDuration    = slotDuration;
            MaxAppointments = maxAppointments;
            IsActive        = isActive;
        }

        [JsonPropertyName("schedule_id")]
        [JsonPropertyOrder(1)]
        public long ScheduleId
        {
            get => _scheduleId ?? 0L;
            set => _scheduleId = value;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(2)]
        public long DoctorId
        {
            get => _doctorId ?? 0L;
            set => _doctorId = value;
        }

        [JsonPropertyName("day_of_week")]
        [JsonPropertyOrder(3)]
        public string DayOfWeek
        {
            get => _dayOfWeek ?? string.Empty;
            set => _dayOfWeek = NormalizeSpaces(value);
        }

        [JsonPropertyName("start_time")]
        [JsonPropertyOrder(4)]
        public string StartTime
        {
            get => _startTime ?? string.Empty;
            set => _startTime = value;
        }

        [JsonPropertyName("end_time")]
        [JsonPropertyOrder(5)]
        public string EndTime
        {
            get => _endTime ?? string.Empty;
            set => _endTime = value;
        }

        [JsonPropertyName("slot_duration")]
        [JsonPropertyOrder(6)]
        public int SlotDuration
        {
            get => _slotDuration ?? 0;
            set => _slotDuration = value;
        }

        [JsonPropertyName("max_appointments")]
        [JsonPropertyOrder(7)]
        public int MaxAppointments
        {
            get => _maxAppointments ?? 0;
            set => _maxAppointments = value;
        }

        [JsonPropertyName("is_active")]
        [JsonPropertyOrder(8)]
        public bool IsActive
        {
            get => _isActive;
            set => _isActive = value;
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(DoctorSchedule? other)
        {
            if (other is null) return false;
            if (ReferenceEquals(this, other)) return true;
            if (ScheduleId > 0 || other.ScheduleId > 0) return ScheduleId == other.ScheduleId;
            return DoctorId == other.DoctorId
                && string.Equals(DayOfWeek, other.DayOfWeek, StringComparison.OrdinalIgnoreCase)
                && string.Equals(StartTime, other.StartTime, StringComparison.OrdinalIgnoreCase)
                && string.Equals(EndTime, other.EndTime, StringComparison.OrdinalIgnoreCase)
                && SlotDuration == other.SlotDuration
                && MaxAppointments == other.MaxAppointments
                && IsActive == other.IsActive;
        }

        public override bool Equals(object? obj) => Equals(obj as DoctorSchedule);

        public override int GetHashCode()
        {
            if (ScheduleId > 0) return ScheduleId.GetHashCode();
            return HashCode.Combine(DoctorId, DayOfWeek?.ToLowerInvariant(), StartTime?.ToLowerInvariant(), EndTime?.ToLowerInvariant(), SlotDuration, MaxAppointments, IsActive);
        }
    }
}

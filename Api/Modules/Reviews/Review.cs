using System;
using System.Text.Json.Serialization;

namespace Medical.Api.Modules.Review
{
    public sealed class Review : IEquatable<Review>
    {
        private long?    _reviewId;
        private long?    _doctorId;
        private long?    _patientId;
        private int?     _rating;
        private string?  _comment;
        private string?  _createdAt;

        public Review() { }

        public Review(long reviewId, long patientId, int rating, string comment,
                      string createdAt)
        {
            ReviewId        = reviewId;
            PatientId       = patientId;
            Rating          = rating;
            Comment         = comment;
            CreatedAt       = createdAt;
        }

        [JsonPropertyName("review_id")]
        [JsonPropertyOrder(1)]
        public long ReviewId
        {
            get => _reviewId ?? 0L;
            set => _reviewId = value;
        }

        [JsonPropertyName("doctor_id")]
        [JsonPropertyOrder(2)]
        public long DoctorId
        {
            get => _doctorId ?? 0L;
            set => _doctorId = value;
        }

        [JsonPropertyName("patient_id")]
        [JsonPropertyOrder(3)]
        public long PatientId
        {
            get => _patientId ?? 0L;
            set => _patientId = value;
        }

        [JsonPropertyName("rating")]
        [JsonPropertyOrder(4)]
        public int? Rating
        {
            get => _rating;
            set => _rating = value;
        }

        [JsonPropertyName("comment")]
        [JsonPropertyOrder(5)]
        public string Comment
        {
            get => _comment ?? string.Empty;
            set => _comment = NormalizeSpaces(value);
        }

        [JsonPropertyName("created_at")]
        [JsonPropertyOrder(6)]
        public string CreatedAt
        {
            get => _createdAt ?? string.Empty;
            set => _createdAt = value;
        }

        private static string NormalizeSpaces(string? input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var trimmed = input.Trim();
            var parts   = trimmed.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(' ', parts);
        }

        public bool Equals(Review? other)
        {
            if (other is null) return false;
            return ReviewId == other.ReviewId;
        }

        public override bool Equals(object? obj) => Equals(obj as Review);

        public override int GetHashCode() => ReviewId.GetHashCode();
    }
}
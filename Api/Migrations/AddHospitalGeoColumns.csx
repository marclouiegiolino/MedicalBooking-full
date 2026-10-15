using Microsoft.Data.Sqlite;

// Path to the database
var dbPath = @"C:\medicalBooking\hospital.db";
var cs = $"Data Source={dbPath}";

Console.WriteLine($"Opening database: {dbPath}");
using var conn = new SqliteConnection(cs);
conn.Open();

// Read existing columns from PRAGMA
var existingCols = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
using (var check = conn.CreateCommand())
{
    check.CommandText = "PRAGMA table_info(hospital_information)";
    using var reader = check.ExecuteReader();
    while (reader.Read())
    {
        existingCols.Add(reader["name"].ToString()!);
    }
}

Console.WriteLine($"Existing columns: {string.Join(", ", existingCols)}");

// Add missing columns
var missing = new[]
{
    ("latitude",       "REAL NOT NULL DEFAULT 0"),
    ("longitude",      "REAL NOT NULL DEFAULT 0"),
    ("service_radius", "REAL NOT NULL DEFAULT 0"),
};

foreach (var (col, def) in missing)
{
    if (!existingCols.Contains(col))
    {
        using var alter = conn.CreateCommand();
        alter.CommandText = $"ALTER TABLE hospital_information ADD COLUMN {col} {def}";
        alter.ExecuteNonQuery();
        Console.WriteLine($"✅ Added column: {col}");
    }
    else
    {
        Console.WriteLine($"✔ Column already exists: {col}");
    }
}

Console.WriteLine("Migration complete!");

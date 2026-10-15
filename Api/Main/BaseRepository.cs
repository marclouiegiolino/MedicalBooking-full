#nullable enable
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;

namespace Medical.Api.Main
{
    public abstract class BaseRepository
    {
        protected readonly MyCon _db;

        protected BaseRepository(MyCon dbConnection)
        {
            if (dbConnection is null)
                throw new ArgumentNullException(nameof(dbConnection));

            _db = dbConnection;
        }

        protected async Task<T?> ExecuteScalarAsync<T>(
            string sql,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            DbTransaction? transaction = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));

            await using var connection = _db.GetConnection();
            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);

            await connection.OpenAsync(ct).ConfigureAwait(false);
            var result = await command.ExecuteScalarAsync(ct).ConfigureAwait(false);
            return SafeChangeType<T>(result);
        }

        protected async Task<int> ExecuteNonQueryAsync(
            string sql,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            DbTransaction? transaction = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));

            await using var connection = _db.GetConnection();
            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);

            await connection.OpenAsync(ct).ConfigureAwait(false);
            return await command.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
        }

        protected async Task<List<T>> ExecuteReaderToListAsync<T>(
            string sql,
            Func<DbDataReader, T> mapper,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            DbTransaction? transaction = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));
            if (mapper is null)
                throw new ArgumentNullException(nameof(mapper));

            var list = new List<T>();

            await using var connection = _db.GetConnection();
            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);

            await connection.OpenAsync(ct).ConfigureAwait(false);
            await using var reader = await command.ExecuteReaderAsync(CommandBehavior.CloseConnection, ct)
                                                  .ConfigureAwait(false);

            while (await reader.ReadAsync(ct).ConfigureAwait(false))
                list.Add(mapper(reader));

            return list;
        }

        /// <summary>
        /// Runs <paramref name="work"/> against a single open connection and transaction,
        /// committing on success and rolling back on any exception. Every statement issued
        /// inside <paramref name="work"/> must use the supplied connection/transaction
        /// (via the transactional execute overloads below) to participate atomically.
        /// </summary>
        protected async Task<T> WithTransactionAsync<T>(
            Func<DbConnection, DbTransaction, Task<T>> work,
            IsolationLevel isolation = IsolationLevel.ReadCommitted,
            CancellationToken ct = default)
        {
            if (work is null)
                throw new ArgumentNullException(nameof(work));

            await using var connection = _db.GetConnection();
            await connection.OpenAsync(ct).ConfigureAwait(false);
            await using var tx = await connection.BeginTransactionAsync(isolation, ct).ConfigureAwait(false);
            try
            {
                var result = await work(connection, tx).ConfigureAwait(false);
                await tx.CommitAsync(ct).ConfigureAwait(false);
                return result;
            }
            catch
            {
                await tx.RollbackAsync(ct).ConfigureAwait(false);
                throw;
            }
        }

        /// <summary>Transactional overload: runs on the supplied open connection/transaction.</summary>
        protected static async Task<T?> ExecuteScalarAsync<T>(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            CancellationToken ct = default)
        {
            if (connection is null)
                throw new ArgumentNullException(nameof(connection));
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));

            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);
            var result = await command.ExecuteScalarAsync(ct).ConfigureAwait(false);
            return SafeChangeType<T>(result);
        }

        /// <summary>Transactional overload: runs on the supplied open connection/transaction.</summary>
        protected static async Task<int> ExecuteNonQueryAsync(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            CancellationToken ct = default)
        {
            if (connection is null)
                throw new ArgumentNullException(nameof(connection));
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));

            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);
            return await command.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
        }

        /// <summary>Transactional overload: runs on the supplied open connection/transaction.</summary>
        protected static async Task<List<T>> ExecuteReaderToListAsync<T>(
            DbConnection connection,
            DbTransaction transaction,
            string sql,
            Func<DbDataReader, T> mapper,
            IEnumerable<DbParameter>? parameters = null,
            CommandType commandType = CommandType.Text,
            int? commandTimeoutSeconds = null,
            CancellationToken ct = default)
        {
            if (connection is null)
                throw new ArgumentNullException(nameof(connection));
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL is required.", nameof(sql));
            if (mapper is null)
                throw new ArgumentNullException(nameof(mapper));

            var list = new List<T>();

            await using var command = PrepareCommand(connection, sql, commandType, commandTimeoutSeconds, transaction, parameters);
            // Default behavior (NOT CloseConnection): the connection is owned by WithTransactionAsync.
            await using var reader = await command.ExecuteReaderAsync(ct).ConfigureAwait(false);

            while (await reader.ReadAsync(ct).ConfigureAwait(false))
                list.Add(mapper(reader));

            return list;
        }

        /// <summary>
        /// Creates a provider-native parameter directly, without allocating a throwaway
        /// connection/command per call.
        /// </summary>
        protected static DbParameter CreateParameter(
            string name,
            object? value,
            DbType? dbType = null,
            int? size = null,
            ParameterDirection direction = ParameterDirection.Input)
        {
            var p = new SqliteParameter(name, value ?? DBNull.Value);
            p.Direction = direction;
            if (dbType.HasValue) p.DbType = dbType.Value;
            if (size.HasValue && size.Value > 0) p.Size = size.Value;

            return p;
        }

        /// <summary>
        /// Reads a column value from the reader, coercing it safely to <typeparamref name="T"/>,
        /// returning <paramref name="defaultValue"/> when the column is NULL, empty, or unparseable.
        /// </summary>
        protected static T ReadValue<T>(DbDataReader reader, string columnName, T defaultValue)
        {
            try
            {
                int ordinal = reader.GetOrdinal(columnName);
                if (ordinal < 0 || reader.IsDBNull(ordinal))
                {
                    return defaultValue;
                }

                object value = reader.GetValue(ordinal);
                if (value is null || value is DBNull)
                {
                    return defaultValue;
                }

                if (value is T typedValue)
                {
                    return typedValue;
                }

                string strVal = Convert.ToString(value, CultureInfo.InvariantCulture)?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(strVal))
                {
                    return defaultValue;
                }

                Type targetType = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);
                if (targetType == typeof(string))
                {
                    return (T)(object)strVal;
                }

                if (targetType == typeof(decimal))
                {
                    if (value is decimal dec) return (T)(object)dec;
                    if (value is double dbl) return (T)(object)Convert.ToDecimal(dbl);
                    if (value is float flt) return (T)(object)Convert.ToDecimal(flt);
                    if (value is int i) return (T)(object)Convert.ToDecimal(i);
                    if (value is long l) return (T)(object)Convert.ToDecimal(l);
                    if (decimal.TryParse(strVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedDecimal))
                        return (T)(object)parsedDecimal;
                    return defaultValue;
                }

                if (targetType == typeof(int))
                {
                    if (value is int i) return (T)(object)i;
                    if (value is long l) return (T)(object)(int)l;
                    if (value is double dbl) return (T)(object)(int)dbl;
                    if (int.TryParse(strVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedInt))
                        return (T)(object)parsedInt;
                    return defaultValue;
                }

                if (targetType == typeof(long))
                {
                    if (value is long l) return (T)(object)l;
                    if (value is int i) return (T)(object)(long)i;
                    if (value is double dbl) return (T)(object)(long)dbl;
                    if (long.TryParse(strVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedLong))
                        return (T)(object)parsedLong;
                    return defaultValue;
                }

                if (targetType == typeof(double))
                {
                    if (value is double dbl) return (T)(object)dbl;
                    if (value is float flt) return (T)(object)(double)flt;
                    if (value is decimal dec) return (T)(object)(double)dec;
                    if (value is int i) return (T)(object)(double)i;
                    if (value is long l) return (T)(object)(double)l;
                    if (double.TryParse(strVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedDbl))
                        return (T)(object)parsedDbl;
                    return defaultValue;
                }

                if (targetType == typeof(float))
                {
                    if (value is float flt) return (T)(object)flt;
                    if (value is double dbl) return (T)(object)(float)dbl;
                    if (value is decimal dec) return (T)(object)(float)dec;
                    if (value is int i) return (T)(object)(float)i;
                    if (value is long l) return (T)(object)(float)l;
                    if (float.TryParse(strVal, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedFlt))
                        return (T)(object)parsedFlt;
                    return defaultValue;
                }

                if (targetType == typeof(bool))
                {
                    if (bool.TryParse(strVal, out var parsedBool))
                        return (T)(object)parsedBool;
                    if (int.TryParse(strVal, out var parsedInt))
                        return (T)(object)(parsedInt != 0);
                    return defaultValue;
                }

                if (targetType == typeof(DateTime))
                {
                    if (DateTime.TryParse(strVal, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDt))
                        return (T)(object)parsedDt;
                    return defaultValue;
                }

                if (targetType == typeof(Guid))
                {
                    if (Guid.TryParse(strVal, out var parsedGuid))
                        return (T)(object)parsedGuid;
                    return defaultValue;
                }

                return (T)Convert.ChangeType(value, targetType, CultureInfo.InvariantCulture);
            }
            catch
            {
                return defaultValue;
            }
        }

        // -------- internals --------
        private static DbCommand PrepareCommand(
            DbConnection connection,
            string sql,
            CommandType commandType,
            int? commandTimeoutSeconds,
            DbTransaction? transaction,
            IEnumerable<DbParameter>? parameters)
        {
            var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandType = commandType;

            if (transaction != null)
                command.Transaction = transaction;

            if (commandTimeoutSeconds.HasValue && commandTimeoutSeconds.Value > 0)
                command.CommandTimeout = commandTimeoutSeconds.Value;

            if (parameters != null)
            {
                foreach (var p in parameters)
                {
                    // Clone into this command to avoid reuse issues
                    var clone = command.CreateParameter();
                    clone.ParameterName = p.ParameterName;
                    clone.Value = p.Value;
                    clone.Direction = p.Direction;
                    clone.DbType = p.DbType;
                    clone.Size = p.Size;
                    command.Parameters.Add(clone);
                }
            }

            return command;
        }

        private static T? SafeChangeType<T>(object? value)
        {
            if (value is null || value is DBNull) return default;
            if (value is T t) return t;

            var targetType = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);
            return (T)Convert.ChangeType(value, targetType);
        }
    }
}
using Medical.Api.Main;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Medical.Api.Modules.Patients
{
    public interface IPatientsRepository
    {
        Task<IEnumerable<Patients>> GetAllAsync();
        Task<Patients?> GetByIdAsync(long id);
        Task<Patients?> GetByUserIdAsync(long userId);
        Task<bool> ExistsAsync(long id);
        Task AddAsync(Patients entity);
        Task UpdateAsync(Patients entity);
        Task DeleteAsync(long id);
        Task<PaginationModel<Patients>> GetPaginatedAsync(int pageNumber, int pageSize);
    }
}

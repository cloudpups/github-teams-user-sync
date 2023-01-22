using Gttsb.Core;
using Microsoft.AspNetCore.Mvc;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public sealed class SyncController : ControllerBase
    {
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;

        public SyncController(IGitHubFacadeFactory gitHubFacadeFactory)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
        }

        // TODO: expose proper model instead of returning internal model
        public async Task<IEnumerable<Installation>> GetInstalledOrgs()
        {
            var installedGitHubOrgs = await gitHubFacadeFactory.GetInstallationsAsync();

            return installedGitHubOrgs.Select(i => new Installation(i.Id, i.OrgName)).ToList();
        }
    }
}

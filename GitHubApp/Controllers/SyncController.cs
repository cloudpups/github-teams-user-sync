using Gttsb.Core;
using Microsoft.AspNetCore.Mvc;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public sealed class SyncController : ControllerBase
    {
        private readonly IGitHubFacade gitHubFacade;

        public SyncController(IGitHubFacade gitHubFacade)
        {
            this.gitHubFacade = gitHubFacade;
        }

        public async Task<IEnumerable<Installation>> GetInstalledOrgs()
        {
            var installedGitHubOrgs = await gitHubFacade.GetInstallationsAsync();

            return installedGitHubOrgs.Select(i => new Installation(i.Id)).ToList();
        }
    }
}

using Gttsb.Core;
using Gttsb.Gh;
using Microsoft.AspNetCore.Mvc;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public sealed class SyncController : ControllerBase
    {
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;

        public SyncController(IGitHubFacadeFactory gitHubFacadeFactory)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
        }

        [HttpGet(Name = "Syncronize Org")]        
        public async Task SynconrizeOrg(long installationId)
        {
            var installation = await gitHubFacadeFactory.GetInstallationAsync(installationId);
            var client = await gitHubFacadeFactory.CreateClientForOrgAsync(installation);

            await Bootstrap.StartTeamSyncAsync(null, client);
        }
    }
}

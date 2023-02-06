using Gttsb.Core;
using Gttsb.Gh;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public sealed class SyncController : ControllerBase
    {
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;
        private readonly IActiveDirectoryFacade activeDirectoryFacade;
        private readonly AppOptions appOptions;

        public SyncController(IGitHubFacadeFactory gitHubFacadeFactory, IActiveDirectoryFacade activeDirectoryFacade, IOptions<AppOptions> appOptions)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
            this.activeDirectoryFacade = activeDirectoryFacade;
            this.appOptions = appOptions.Value;
        }

        [HttpGet(Name = "Syncronize Org")]        
        public async Task SynconrizeOrg(long installationId)
        {
            var installation = await gitHubFacadeFactory.GetInstallationAsync(installationId);
            var client = await gitHubFacadeFactory.CreateClientForOrgAsync(installation);

            await Bootstrap.StartTeamSyncAsync(activeDirectoryFacade, client, appOptions);
        }

        [HttpGet(Name = "Syncronize Security Managers")]
        public async Task SynconrizeSecurityManagers(long installationId)
        {
            var installation = await gitHubFacadeFactory.GetInstallationAsync(installationId);
            var client = await gitHubFacadeFactory.CreateClientForOrgAsync(installation);

            // await client.AddSecurityManagerTeamAsync("");            
        }
    }
}

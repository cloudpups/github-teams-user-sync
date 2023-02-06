using GitHubApp.Models;
using Gttsb.Core;
using Gttsb.Gh;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrchestratorController : ControllerBase
    {        
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;
        private readonly IActiveDirectoryFacade activeDirectoryFacade;
        private readonly AppOptions appOptions;

        public OrchestratorController(IGitHubFacadeFactory gitHubFacadeFactory, IActiveDirectoryFacade activeDirectoryFacade, IOptions<AppOptions> appOptions)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
            this.activeDirectoryFacade = activeDirectoryFacade;
            this.appOptions = appOptions.Value;
        }

        [HttpPost(Name = "Sync All Orgs")]
        public async Task<IEnumerable<SyncResult>> SyncAllOrgs()
        {
            var installedGitHubOrgs = await gitHubFacadeFactory.GetInstallationsAsync();

            var installations = installedGitHubOrgs.Select(i => new Models.Installation
            {
                Id = i.Id,
                OrgName = i.OrgName
            }).ToList();

            if(installations == null)
            {
                return Enumerable.Empty<SyncResult>();
            }

            var syncJobs = installations.Select(i => SyncOrgAsync(i.Id)).ToList();

            var results = await Task.WhenAll(syncJobs);

            return results;
        }

        private async Task<SyncResult> SyncOrgAsync(long installationId)
        {
            var installation = await gitHubFacadeFactory.GetInstallationAsync(installationId);
            var client = await gitHubFacadeFactory.CreateClientForOrgAsync(installation);

            try
            {
                await Bootstrap.StartTeamSyncAsync(activeDirectoryFacade, client, appOptions);
            }            
            catch
            {
                return new SyncResult
                {
                    OrgName = client.OrgName,
                    Succeeded = false
                };
            }

            return new SyncResult
            {
                OrgName = client.OrgName,
                Succeeded = true
            };
        }
    }
}

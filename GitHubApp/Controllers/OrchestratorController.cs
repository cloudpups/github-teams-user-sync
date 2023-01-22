using GitHubApp.Models;
using Gttsb.Core;
using Gttsb.Gh;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace GitHubApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrchestratorController : ControllerBase
    {        
        private readonly IGitHubFacadeFactory gitHubFacadeFactory;
        private readonly IActiveDirectoryFacade activeDirectoryFacade;

        public OrchestratorController(IGitHubFacadeFactory gitHubFacadeFactory, IActiveDirectoryFacade activeDirectoryFacade)
        {
            this.gitHubFacadeFactory = gitHubFacadeFactory;
            this.activeDirectoryFacade = activeDirectoryFacade;
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
                await Bootstrap.StartTeamSyncAsync(activeDirectoryFacade, client);
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

namespace Gttsb.Core
{
    public static class GroupSyncerBuilder
    {
        public static IGroupSyncer Build(IActiveDirectoryFacade adFacade, IInstalledGitHubFacade gFacade, IEmailToCloudIdConverter emailToCloudIdConverter)
        {
            return new GroupSyncer(adFacade, gFacade, emailToCloudIdConverter);
        }
    }
}

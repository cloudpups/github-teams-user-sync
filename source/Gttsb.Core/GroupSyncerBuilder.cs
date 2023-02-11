namespace Gttsb.Core
{
    public static class GroupSyncerBuilder
    {
        public static IGroupSyncer Build(IActiveDirectoryFacade adFacade, IInstalledGitHubFacade gFacade, AppOptions appOptions)
        {
            return new GroupSyncer(adFacade, gFacade, appOptions);
        }
    }
}

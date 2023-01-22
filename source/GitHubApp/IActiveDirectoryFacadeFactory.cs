using Gttsb.Core;

internal interface IActiveDirectoryFacadeFactory
{
    IActiveDirectoryFacade GetActiveDirectoryClient();
}
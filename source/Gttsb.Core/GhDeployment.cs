namespace Gttsb.Core
{
    public record GhDeployment(int Id, string Org, string Repo)
    {
        public enum Status
        {
            Succeeded,
            Failed
        }
    }
}

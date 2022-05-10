namespace Gttsb.Core
{
    public interface IEmailToCloudIdConverter
    {
        string ToId(string email);
    }
}

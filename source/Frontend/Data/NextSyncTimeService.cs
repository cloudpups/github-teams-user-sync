using NCrontab;

namespace Frontend.Data
{
    internal sealed class NextSyncTimeService
    {
        private readonly IConfiguration configuration;

        public NextSyncTimeService(IConfiguration configuration)
        {
            this.configuration = configuration;
        }

        public DateTime GetNextTime(DateTime now)
        {
            // https://crontabkit.com
            var cronSchedule = configuration["syncSchedule"];
            var schedule = CrontabSchedule.Parse(cronSchedule);
            return schedule.GetNextOccurrence(now);
        }
    }
}
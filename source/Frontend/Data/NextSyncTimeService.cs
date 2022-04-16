using NCrontab;

namespace Frontend.Data
{
    public sealed class NextSyncTimeService
    {
        public DateTime GetNextTime(DateTime now)
        {
            // https://crontabkit.com
            var schedule = CrontabSchedule.Parse("*/5 * * * *");
            return schedule.GetNextOccurrence(now);
        }
    }
}
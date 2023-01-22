namespace Gttsb.Gh
{
    public static class EnumerableExtensions
    {
        public static bool IsEmptyOrContainsOneBlankString(this IEnumerable<string> e)
        {
            if(!e.Any())
            {
                return true;
            }

            if(e.Count() == 1 && string.IsNullOrWhiteSpace(e.First()))
            {
                return true;
            }

            return false;
        }
    }
}

namespace Frontend.Data
{
    internal enum TeamSyncStatuses
    {
        /// <summary>
        /// Error will be returned if there was an error during syncronization OR
        /// if the team does not exist.
        /// </summary>
        Error,
        /// <summary>
        /// Success will be returned if a team was successfully syncronized.
        /// </summary>
        Success
    }
}

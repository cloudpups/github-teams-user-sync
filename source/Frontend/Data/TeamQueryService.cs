using System.Web;

namespace Frontend.Data
{
    internal sealed class TeamQueryService
    {
        private readonly IConfiguration configuration;
        private readonly IHttpClientFactory httpClientFactory;
        private readonly ILogger<string> logger;

        public TeamQueryService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<string> logger)
        {
            this.configuration = configuration;
            this.httpClientFactory = httpClientFactory;
            this.logger = logger;
        }

        public async Task<TeamSyncStatuses> GetStatusAsync(TeamQueryModel model)
        {
            var httpClient = httpClientFactory.CreateClient("Backend");

            // TODO: Gross, use http client factory properly
            var backendUrl = configuration["backendUrl"];
            httpClient.BaseAddress = new Uri(backendUrl);

            var httpResponseMessage = await httpClient.GetAsync($"api/search?org={model.OrganizationName}&team={model.TeamName}");

            if (httpResponseMessage.IsSuccessStatusCode)
            {
                using var contentStream =
                    await httpResponseMessage.Content.ReadAsStreamAsync();

                // TODO: actually do conversion and logic

                return TeamSyncStatuses.Success;
            }

            return TeamSyncStatuses.Error;
        }
    }
}

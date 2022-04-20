using Microsoft.Extensions.DependencyInjection;

namespace GitHubAction.Extensions;

static class ServiceCollectionExtensions
{
    // We may want this later... Yes yes... YAGNI. I'm still going to leave it.
    internal static IServiceCollection AddGitHubActionServices(this IServiceCollection services) => services;
}
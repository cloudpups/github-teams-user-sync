#See https://aka.ms/containerfastmode to understand how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/runtime:6.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["source/GitHubAction/GitHubAction.csproj", "source/GitHubAction/"]
RUN dotnet restore "source/GitHubAction/GitHubAction.csproj"
COPY . .
WORKDIR "/src/source/GitHubAction"
RUN dotnet build "GitHubAction.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "GitHubAction.csproj" -c Release -o /app/publish --no-self-contained

LABEL maintainer="Joshua Miller <joshdan65@gmail.com>"
LABEL repository="https://github.com/JoshuaTheMiller/groups-to-teams-sync-bot"
LABEL homepage="https://github.com/JoshuaTheMiller/groups-to-teams-sync-bot"

LABEL com.github.actions.name="Groups to Teams Sync"
LABEL com.github.actions.description="Sync Azure AD Groups and GH Teams in a very opinionated fashion! Note: this is probably only useful for GitHub Enterprise Cloud."
# See branding:
# https://docs.github.com/actions/creating-actions/metadata-syntax-for-github-actions#branding
LABEL com.github.actions.icon="activity"
LABEL com.github.actions.color="orange"

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "GitHubAction.dll"]
export function Config() {    
    const config = {
        GitHub: {
            AppId: Number.parseInt(process.env.GitHubApp__AppId!),
            PrivateKey: process.env.GitHubApp__PrivateKey!
        }
    }

    return config;
}
import dotenv from "dotenv";
import { GetClient } from "./src/services/github";

dotenv.config();

async function DoSomething() {    
    const client = GetClient();
    const sampleInstallationId = Number.parseInt(process.env.SAMPLE_INSTALLATION_ID!);
    const orgClient = await client.GetOrgClient(sampleInstallationId);    
    const response = await orgClient.GetAllTeams()
    console.log(response);
}

DoSomething();


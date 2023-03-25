import fs from "fs"
import { Config } from "./src/config";
import { GetClient } from "./src/services/gitHub";
import { SearchAllAsync } from "./src/services/ldapClient";

async function DoSomething() {        
    // const groupName = process.env.SAMPLE_GROUPNAME!;
    // const what = await SearchAllAsync(groupName);
    // console.log(what.entries);    
    // fs.writeFileSync("./what.json", JSON.stringify(what.entries));

    const ghClient = GetClient();
    const config = await ghClient.GetAppConfig();
    console.log(config);
}

DoSomething();
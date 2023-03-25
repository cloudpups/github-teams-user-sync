import fs from "fs"
import { Config } from "./src/config";
import { SearchAllAsync } from "./src/services/ldapClient";

async function DoSomething() {        
    const groupName = process.env.SAMPLE_GROUPNAME!;
    const what = await SearchAllAsync(groupName);
    console.log(what.entries);    
    fs.writeFileSync("./what.json", JSON.stringify(what.entries));
}

DoSomething();
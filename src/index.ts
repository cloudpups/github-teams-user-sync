import express from "express";
import {OpenAPIBackend, Document} from 'openapi-backend';
import yaml from "js-yaml";
import fs from "fs";
import path from "node:path";
import {OrgModel} from "./types/sync-models";
import swaggerUi from "swagger-ui-express"; 

const app = express();
const port = 3000;

// TODO: fix/determine why OpenAPIBackend is having issues loading files on its own...
const doc = yaml.load(fs.readFileSync(path.resolve(__dirname, 'openapi.yaml'), 'utf8'));

const castDoc = doc as Document;

const api = new OpenAPIBackend({ definition: castDoc });

const sampleOrgResponse : OrgModel[] = [
    {id:1, orgName:"Test"}
]

api.register({
    getInstalledOrgs: (c, req, res) => res.status(200).json(sampleOrgResponse),
    validationFail: (c, _, res) => res.status(400).json({ err: c.validation.errors }),
    notFound: (c, _, res) => res.status(404).json({ err: 'not found' }),
  });

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc as swaggerUi.JsonObject));
app.use((req:any, res:any) => api.handleRequest(req, req, res));

app.listen(port);
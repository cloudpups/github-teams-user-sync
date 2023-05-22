import express from "express";
import { OpenAPIBackend, Document } from 'openapi-backend';
import yaml from "js-yaml";
import fs from "fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { routes } from "./routes";

const app = express();

const port = 8080;

// TODO: fix/determine why OpenAPIBackend is having issues loading files on its own...
const doc = yaml.load(fs.readFileSync(path.resolve(__dirname, 'openapi.yaml'), 'utf8'));

const castDoc = doc as Document;

const api = new OpenAPIBackend({ definition: castDoc });

api.register({
  ...routes,
  validationFail: (c, _, res) => res.status(400).json({ err: c.validation.errors }),
  notFound: (c, _, res) => res.status(404).json({ err: 'not found' }),
});

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc as swaggerUi.JsonObject));

app.use((req: any, res: any) => {
    api.handleRequest(req, req, res).catch((reason:any) => {
      console.log(reason);      

      res.status(500).json({ err: 'An internal error occurred :( Please ask the maintainers of the running application to check the logs.' })
    })
});

app.listen(port);
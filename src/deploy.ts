/**
 * Example deployment file.
 */

import axios from "axios";
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';

/*
const serverUrl = process.env.DXP_OE_SERVER_URL;
const serverToken = process.env.DXP_OE_SERVER_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;

*/


const serverUrl = "http://localhost:8082";
const serverToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ0YzE1MGE4LTUyNGYtNDNlZi05ZmNjLWRhMmY0Y2IxMDNmOSIsInV1aWQiOiJkNDhkOTg0NC1kNTdlLTQwNTMtODYwZC04ZmYxNWFhYTBlY2EiLCJpYXQiOjE2ODAwOTk0NzgsImV4cCI6MTY4Mjg2NDI3OH0.lHYNvvHRHAVrWRCTfau7bm6aawVAVgbTB_AN9aZVnnk";
const githubToken = "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";


/*
const serverUrl = "http://localhost:8080";
const serverToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ0YzE1MGE4LTUyNGYtNDNlZi05ZmNjLWRhMmY0Y2IxMDNmOSIsInV1aWQiOiI2N2Q4MTU5MC1iMmU0LTQxZmMtOWZjYy00ZDNlMTQ3Nzk3YzQiLCJpYXQiOjE2ODAxMDIwNDEsImV4cCI6MTY4MjY5NDA0MX0.IbIaaYRLDf2AnZ3NOIEy1YQTVeqdshG9VXsnUCv_nIM";
const githubToken = "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";
*/

console.log('serverUrl :'+serverUrl);
console.log('serverToken :'+serverToken);
console.log('githubToken :'+githubToken);

const server = "http://localhost:8082";
/*const server = "http://localhost:8080";*/
const deleteUrl = (server: string) => `${server}/api/functions/Package/DelPackageAndArtifacts`
const cloneUrl = (server: string) => `${server}/api/functions/Package/CloneRepository`;
const getUrl = (server: string) => `${server}/api/functions/Package/Get`;
const importUrl = (server: string) => `${server}/api/functions/Package/ImportRepository`;

console.log('deleteUrl :'+deleteUrl);
console.log('cloneUrl :'+cloneUrl);
console.log('getUrl :'+getUrl);
console.log('importUrl :'+importUrl);

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function axiosPost(url: string, data: unknown, config: Record<string, unknown> = {}) {
    return axios.post(url, data, { httpsAgent, headers: {
            'Authorization': `Bearer ${serverToken}`,
        }, ...config});
}

async function readFile(
    path: fs.PathLike,
    options?: { encoding?: BufferEncoding; flag?: string } | BufferEncoding,
): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, options, (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

async function readPackageFile() {
    const content = await readFile(path.join(path.join(process.cwd(), 'artifacts'), 'dev_package.json'), 'utf-8') as string;
    return JSON.parse(content);
}

async function getPackageFromServer(id: string): Promise<boolean> {
    try {
        console.log('Inside function getPackageFromServer()...... ');
        console.log('id : ' + id);
        console.log('serverUrl : ' + serverUrl);
        await axiosPost(getUrl(serverUrl), { id });
        return true;
    } catch (e) {
        if (e.response.status === 404) {
            return false;
        }
        console.error('Error getting package from server');
        throw e;
    }
}

(async () => {
    try {
        const devPackage = await readPackageFile();
        const id = devPackage.id;
        const url = devPackage.git.remote;

        const packageExists = await getPackageFromServer(id);
        if (!packageExists) {
            console.log('Package does not exist on server, cloning...');
            const cloneResult = await axiosPost(cloneUrl(serverUrl), {url, auth: {authType: 1, token: githubToken}});
            console.log('Package has been cloned on server');
            const errorLog = cloneResult.data.importLog.data.filter(entry => entry.transferStatus === 'Error');
            if (errorLog.length > 0) {
                console.warn(`One or more artifacts failed to deploy`, errorLog);
            }
            
            return process.exit(0);
        }

        console.log('Package exists on server, importing...');
        
        const importResult = await axiosPost(importUrl(serverUrl), {id, branch: 'master', auth: {authType: 1, token: githubToken}, forceUpdate: true});
        console.log('Package has been imported on server');
        const errorLog = importResult.data.importLog.data.filter(entry => entry.transferStatus === 'Error');
        if (errorLog.length > 0) {
            console.warn(`One or more artifacts failed to deploy`, errorLog);
        }
        

    } catch (e) {
        console.error('Failed to deploy package', e);
    }
    process.exit(0);
})();

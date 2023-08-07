
function log(s:any) {
    console.log(s);
}

function logError(s:any) {
    console.log(s);
}

export {
    log as Log,
    logError as LogError,
}
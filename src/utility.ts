export type AsyncReturnType<T extends (...args: any) => Promise<any>> =
    T extends (...args: any) => Promise<infer R> ? R : any;

// TODO: split into decorator so as to not mix responsibilities
export function MakeTeamNameSafeAndApiFriendly(teamName: string) {
    return MakeTeamNameSafe(teamName).replace(" ", "-");
}

// TODO: split into decorator so as to not mix responsibilities
function MakeTeamNameSafe(teamName: string) {
    // There are most likely much more than this...
    const specialCharacterRemoveRegexp = /[ &%#@!$]/g;
    const saferName = teamName.replaceAll(specialCharacterRemoveRegexp, '-');

    const multiReplaceRegexp = /(-){2,}/g;
    const removeTrailingDashesRegexp = /-+$/g

    const withDuplicatesRemoved = saferName.replaceAll(multiReplaceRegexp, "-").replaceAll(removeTrailingDashesRegexp, "");

    return withDuplicatesRemoved;
}
namespace Gttsb.Core
{
    public record MembersResponse(bool Success, IEnumerable<Member> Members);
}
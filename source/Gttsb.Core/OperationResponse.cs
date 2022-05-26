namespace Gttsb.Core
{
    public enum OperationStatus
    {
        Succeeded,
        Failed
    }

    public sealed record OperationResponse(OperationStatus Status, string Message)
    {
        public static OperationResponse Succeeded() => new OperationResponse(OperationStatus.Succeeded, string.Empty);
        public static OperationResponse Failed(string message) => new OperationResponse(OperationStatus.Failed, message);
    }
}

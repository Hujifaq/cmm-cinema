namespace CMM_Cinema.Models;

public sealed record Admin(
    int Id,
    string Username,
    string PasswordHash,
    int FailedLogins,
    DateTimeOffset? LockoutUntil,
    string SecurityStamp)
{
    public bool IsLockedOut(DateTimeOffset now) => LockoutUntil > now;
}

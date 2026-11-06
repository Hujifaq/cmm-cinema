namespace CMM_Cinema.Models;

public sealed record User(
    int Id,
    string Email,
    string Name,
    string? PasswordHash,
    bool EmailVerified,
    int FailedLogins,
    DateTimeOffset? LockoutUntil,
    string SecurityStamp)
{
    public bool HasPassword => PasswordHash is not null;

    public bool IsLockedOut(DateTimeOffset now) => LockoutUntil > now;
}

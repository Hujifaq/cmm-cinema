using Isopoh.Cryptography.Argon2;

namespace CMM_Cinema.Services;


public sealed class PasswordHasher
{
    private const int TimeCost = 2;
    private const int MemoryCostKiB = 19 * 1024;
    private const int Parallelism = 1;
    private static readonly string CurrentPrefix = $"$argon2id$v=19$m={MemoryCostKiB},t={TimeCost},p={Parallelism}$";

    
    private readonly Lazy<string> _dummyHash = new(() => HashPassword(Guid.NewGuid().ToString()));

    public string Hash(string password) => HashPassword(password);

    public bool Verify(string hash, string password)
    {
        try
        {
            return Argon2.Verify(hash, password);
        }
        catch (Exception)
        {
            return false;
        }
    }

    public void VerifyDummy(string password) => Verify(_dummyHash.Value, password);

   
    public bool NeedsRehash(string hash) => !hash.StartsWith(CurrentPrefix, StringComparison.Ordinal);

    private static string HashPassword(string password) =>
        Argon2.Hash(password, TimeCost, MemoryCostKiB, Parallelism, Argon2Type.HybridAddressing);
}

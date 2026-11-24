# CMM Cinema

An ASP.NET Core MVC cinema website built with .NET 10.

## Requirements

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (for Tailwind CSS and tests)

## Getting started

```sh
cd CMM_Cinema
npm install
dotnet run
```

Then open the URL shown in the terminal.

## Common commands

Run these from `CMM_Cinema`:

| Command | Description |
| --- | --- |
| `npm run dev` | Run with `dotnet watch` |
| `npm run css:build` | Build the Tailwind CSS |
| `npm test` | Run the tests |

## Configuration

Copy `secrets.example.json` and fill in your own keys using
[user secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets).

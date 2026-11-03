#!/bin/zsh
cd "${0:A:h}"
echo "🎬 CMM CINEMA — starting ASP.NET Core MVC"
if ! command -v dotnet >/dev/null 2>&1; then
  echo "ไม่พบคำสั่ง dotnet — กรุณาตรวจสอบการติดตั้ง .NET SDK และ PATH"
  read "?กด Enter เพื่อปิดหน้าต่าง..."
  exit 1
fi
exec dotnet run --project CMM_Cinema/CMM_Cinema.csproj

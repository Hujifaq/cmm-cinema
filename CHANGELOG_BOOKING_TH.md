# CMM CINEMA — งาน Booking สำหรับรวมกับทีม

ต้นทาง: `cmm-cinema-master.zip` ที่อัปโหลดมา โปรเจกต์ ASP.NET Core MVC (`net10.0`)

## ยืนยันไฟล์ของเพื่อนยังอยู่

- `CMM_Cinema/Views/Home/Index.cshtml` — Homepage
- `CMM_Cinema/Views/Shared/_HeroLayout.cshtml` — Layout ของ Homepage
- `CMM_Cinema/Views/Shared/_CinemaNav.cshtml` — Navbar
- `CMM_Cinema/wwwroot/css/styles.css` และไฟล์ asset ของ Homepage
- `CMM_Cinema/Program.cs` — คงการลงทะเบียน `IBookingService` ของต้นฉบับ

## เพิ่ม/แก้เฉพาะงาน Booking

แก้ไขจากชุดเดิม:
- `CMM_Cinema/Controllers/BookingController.cs`
- `CMM_Cinema/Services/Booking/IBookingService.cs`
- `CMM_Cinema/Services/Booking/DemoBookingService.cs`
- `CMM_Cinema/Views/Shared/_BookingLayout.cshtml` (เพิ่มแถบโปรโมชั่นสำหรับหน้าอื่น)
- `CMM_Cinema/Views/Booking/Showtimes.cshtml`
- `CMM_Cinema/Views/Booking/SeatSelection.cshtml`

ไฟล์ใหม่:
- `CMM_Cinema/ViewModels/Booking/BookingFlowViewModels.cs`
- `CMM_Cinema/Views/Booking/_BookingSteps.cshtml`
- `CMM_Cinema/Views/Booking/_OrderCard.cshtml`
- `CMM_Cinema/Views/Booking/Summary.cshtml`
- `CMM_Cinema/Views/Booking/Payment.cshtml`
- `CMM_Cinema/Views/Booking/Confirmation.cshtml`
- `CMM_Cinema/wwwroot/css/booking/showtimes-redesign.css`
- `CMM_Cinema/wwwroot/css/booking/flow.css`
- `CMM_Cinema/wwwroot/js/booking/seat-selection.js`
- `CMM_Cinema/wwwroot/js/booking/hold-timer.js`
- `CMM_Cinema/wwwroot/js/booking/payment.js`

ไม่ได้เปลี่ยน `Program.cs`, Homepage, Navbar, global Tailwind tokens หรือ package.json

## Booking flow

`GET /Booking/Showtimes` → `GET /Booking/SeatSelection?showtimeId=...` →
`POST /Booking/Reserve` → `GET /Booking/Summary?bookingId=...` →
`GET /Booking/Payment?bookingId=...` → `POST /Booking/DemoPay` →
`GET /Booking/Confirmation?bookingId=...`

การเปลี่ยนสถานะทำโดย service ฝั่ง server และ POST มี antiforgery protection

## สำหรับตอนรวม GitHub

แพ็กนี้เป็นโปรเจกต์ที่เปิดได้ในเครื่อง แต่ไม่ได้มี `.git` เพราะไฟล์ต้นทางเป็น ZIP
สามารถนำไฟล์ในรายการนี้ไปใช้ใน branch `feat/booking-flow` ของ Repository ทีม
แล้วเปิด Pull Request เพื่อให้ตรวจสอบก่อน merge โดยไม่ต้องลบ Homepage

## ข้อจำกัดที่ต้องทราบ

- Payment จำลองเท่านั้น ไม่มีการเรียก gateway หรือข้อมูลบัตรเครดิต
- ข้อมูล seat holds/purchases เก็บใน memory ของแอปเท่านั้น ไม่คงอยู่หลัง restart
- ยังไม่มีบัญชีผู้ใช้และการกำหนดสิทธิ์ในการดู booking; ห้ามใช้เป็น production
- ไม่มีการทดสอบ build ด้วย .NET ในสภาพแวดล้อมที่จัดทำไฟล์

## แก้ไขหลังพบ Build error (17 ต.ค. 2026)

- `CMM_Cinema/Services/Booking/DemoBookingService.cs`: แก้ `CS1628` ด้วยการย้าย reference ของ `out BookingDraft? booking` ไปเป็นตัวแปร local ก่อนใช้งานใน lambda
- `RUN_CMM_CINEMA.command` และ `START_HERE_อ่านก่อน.txt`: ใช้ `dotnet run` เป็นคำสั่งเริ่มต้นสำหรับทดสอบบน Mac

คำเตือน: ยังไม่สามารถรัน .NET build ในสภาพแวดล้อมที่จัดทำไฟล์นี้ได้ (ไม่มี .NET SDK)

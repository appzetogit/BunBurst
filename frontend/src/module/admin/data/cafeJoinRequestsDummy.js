// Dummy data for Cafe Join Requests
// Food images from src/assets

import food1 from "@/assets/download.jpg"
import food2 from "@/assets/download (1).jpg"
import food3 from "@/assets/download (3).jpg"
import food4 from "@/assets/download (4).jpg"
import food5 from "@/assets/download (5).jpg"

export const cafeJoinRequestsDummy = [
  {
    sl: 1,
    cafeName: "TEST",
    cafeImage: food1,
    ownerName: "Devid 123",
    ownerPhone: "0**********",
    zone: "All over the World",
    businessModel: "Subscription Base",
    status: "Pending",
  },
  {
    sl: 2,
    cafeName: "Food Paradise",
    cafeImage: food2,
    ownerName: "John Smith",
    ownerPhone: "+1**********",
    zone: "Zone 1",
    businessModel: "Commission Base",
    status: "Pending",
  },
  {
    sl: 3,
    cafeName: "Pizza Corner",
    cafeImage: food3,
    ownerName: "Maria Garcia",
    ownerPhone: "+1**********",
    zone: "All over the World",
    businessModel: "Subscription Base",
    status: "Pending",
  },
  {
    sl: 4,
    cafeName: "Burger House",
    cafeImage: food4,
    ownerName: "David Johnson",
    ownerPhone: "+1**********",
    zone: "Zone 2",
    businessModel: "Commission Base",
    status: "Pending",
  },
  {
    sl: 5,
    cafeName: "Sushi Master",
    cafeImage: food5,
    ownerName: "Sarah Williams",
    ownerPhone: "+1**********",
    zone: "All over the World",
    businessModel: "Subscription Base",
    status: "Pending",
  },
]

export const rejectedCafeRequestsDummy = [
  {
    sl: 1,
    cafeName: "Rejected Cafe",
    cafeImage: food1,
    ownerName: "Test Owner",
    ownerPhone: "+1**********",
    zone: "Zone 1",
    businessModel: "Commission Base",
    status: "Rejected",
  },
]


import { Building } from "lucide-react"
import DisbursementPage from "../components/disbursement/DisbursementPage"
import { cafeDisbursementsDummy } from "../data/cafeDisbursementsDummy"

export default function CafeDisbursement() {
  const tabs = ["All", "Pending", "Completed", "Partially completed", "Canceled"]
  
  return (
    <DisbursementPage
      title="Cafe Disbursement"
      icon={Building}
      tabs={tabs}
      disbursements={cafeDisbursementsDummy}
      count={cafeDisbursementsDummy.length}
    />
  )
}


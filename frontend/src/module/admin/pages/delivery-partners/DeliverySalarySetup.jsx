import { useState, useEffect, useMemo } from "react"
import { Search, Loader2, IndianRupee, Calendar, RefreshCcw } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function DeliverySalarySetup() {
    const [searchQuery, setSearchQuery] = useState("")
    const [deliverymen, setDeliverymen] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editFormData, setEditFormData] = useState(null)
    const [processing, setProcessing] = useState(false)

    // Fetch delivery partners
    const fetchDeliverymen = async () => {
        try {
            setLoading(true)
            setError(null)

            const params = {
                page: 1,
                limit: 1000,
                search: searchQuery.trim()
            }

            const response = await adminAPI.getDeliveryPartners(params)

            if (response.data && response.data.success) {
                setDeliverymen(response.data.data.deliveryPartners || [])
            } else {
                setDeliverymen([])
            }
        } catch (err) {
            console.error("Error fetching delivery partners:", err)
            setError("Failed to fetch delivery partners")
        } finally {
            setLoading(false)
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchDeliverymen()
    }, [])

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDeliverymen()
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const handleEdit = (deliveryman) => {
        setEditFormData({
            id: deliveryman._id,
            name: deliveryman.name,
            email: deliveryman.email,
            phone: deliveryman.phone,
            salary: deliveryman.fullData?.salary?.amount || 0,
            joiningDate: deliveryman.fullData?.joiningDate ?
                new Date(deliveryman.fullData.joiningDate).toISOString().split('T')[0] :
                new Date().toISOString().split('T')[0]
        })
        setIsEditOpen(true)
    }

    const handleUpdate = async (e) => {
        e.preventDefault()
        setProcessing(true)
        try {
            // Prepare payload - only updating salary-related fields
            const payload = {
                name: editFormData.name, // Required by backend API usually
                email: editFormData.email,
                phone: editFormData.phone,
                salary: {
                    type: 'fixed',
                    amount: parseFloat(editFormData.salary)
                },
                joiningDate: editFormData.joiningDate
            }

            await adminAPI.updateDeliveryPartner(editFormData.id, payload)

            toast.success("Salary setup updated successfully")
            setIsEditOpen(false)
            fetchDeliverymen()
        } catch (err) {
            console.error(err)
            toast.error(err.response?.data?.message || "Failed to update salary")
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <IndianRupee className="w-6 h-6 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Delivery Salary Setup</h1>
                                <p className="text-sm text-slate-500">Manage monthly fixed salaries for delivery partners</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>

                            <button
                                onClick={fetchDeliverymen}
                                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                                title="Refresh"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Stats Bar (Optional Summary) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Salaried Staff</h3>
                            <p className="text-2xl font-bold text-blue-900 mt-1">
                                {deliverymen.filter(d => d.fullData?.salary?.type === 'fixed' && d.fullData?.salary?.amount > 0).length}
                            </p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                            <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide">Total Monthly Liability</h3>
                            <p className="text-2xl font-bold text-green-900 mt-1">
                                ₹{deliverymen.reduce((sum, d) => sum + (d.fullData?.salary?.amount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Active Staff</h3>
                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {deliverymen.filter(d => d.isActive).length}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden border-slate-200">
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    <span className="ml-3 text-sm text-slate-600">Loading delivery partners...</span>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 font-medium text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4 text-left w-16">#</th>
                                            <th className="px-6 py-4 text-left">Delivery Partner</th>
                                            <th className="px-6 py-4 text-left">Contact Info</th>
                                            <th className="px-6 py-4 text-left">Joined On</th>
                                            <th className="px-6 py-4 text-right">Monthly Salary</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {deliverymen.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                                    {error ? "Error loading data" : "No delivery partners found"}
                                                </td>
                                            </tr>
                                        ) : (
                                            deliverymen.map((dm, index) => {
                                                const salary = dm.fullData?.salary?.amount || 0;
                                                const hasSalary = salary > 0;

                                                return (
                                                    <tr key={dm._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 text-slate-500">{index + 1}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {dm.profileImage ? (
                                                                    <img
                                                                        src={dm.profileImage}
                                                                        alt={dm.name}
                                                                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                                                                    />
                                                                ) : (
                                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                                                                        <span className="text-xs">IMG</span>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="font-medium text-slate-900">{dm.name}</p>
                                                                    <p className="text-xs text-slate-500">ID: {dm.deliveryId || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-900">{dm.phone}</span>
                                                                <span className="text-xs text-slate-500">{dm.email}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">
                                                            {dm.fullData?.joiningDate ? new Date(dm.fullData.joiningDate).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {hasSalary ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-100">
                                                                    ₹{salary.toLocaleString()}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">Not set</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dm.isActive
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                                : 'bg-red-50 text-red-700 border border-red-100'
                                                                }`}>
                                                                {dm.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => handleEdit(dm)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 hover:border-blue-200 transition-all"
                                                            >
                                                                Setup Salary
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Salary Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-md bg-white p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
                        <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <IndianRupee className="w-5 h-5 text-blue-600" />
                            Salary Setup
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleUpdate}>
                        <div className="p-6 space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {editFormData?.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">{editFormData?.name}</p>
                                        <p className="text-xs text-slate-500">{editFormData?.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Monthly Fixed Salary (₹) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        value={editFormData?.salary}
                                        onChange={(e) => setEditFormData({ ...editFormData, salary: e.target.value })}
                                        placeholder="Ex: 15000"
                                        min="0"
                                        required
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5">
                                    This amount will be fixed monthly. No per-order commission will be given.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Joining Date <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        value={editFormData?.joiningDate}
                                        onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
                                        required
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="px-6 pb-6 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={processing}
                                className="px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                            >
                                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Changes
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Calendar, Clock, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedPage from "../../components/AnimatedPage";
import { diningAPI } from "@/lib/api";
import Loader from "@/components/Loader";

export default function TableBooking() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [selectedGuests, setSelectedGuests] = useState(location.state?.guestCount || 2);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [timeSlots, setTimeSlots] = useState([]);
  const [tablesByTimeSlot, setTablesByTimeSlot] = useState({});
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");

  useEffect(() => {
    const fetchCafe = async () => {
      try {
        const response = await diningAPI.getCafeBySlug(slug);
        if (response.data && response.data.success) {
          const apiCafe = response.data.data;
          const actualCafe = apiCafe?.cafe || apiCafe;
          setCafe(actualCafe);
        }
      } catch (error) {
        console.error("Error fetching cafe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCafe();
  }, [slug]);

  useEffect(() => {
    const fetchDates = async () => {
      if (!cafe?._id) {
        return;
      }

      try {
        const response = await diningAPI.getDates(cafe._id);
        const dates = response.data?.data || [];
        setAvailableDates(dates);

        if (dates.length > 0) {
          const firstDate = new Date(dates[0].date).toISOString().split("T")[0];
          setSelectedDate(firstDate);
        }
      } catch (error) {
        console.error("Error fetching dates:", error);
        setAvailableDates([]);
      }
    };

    fetchDates();
  }, [cafe?._id]);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!cafe?._id || !selectedDate || !selectedGuests) {
        return;
      }

      try {
        setAvailabilityLoading(true);
        const response = await diningAPI.getAvailability({
          cafeId: cafe._id,
          date: selectedDate,
          guests: selectedGuests,
        });

        const data = response.data?.data || {};
        setTimeSlots(data.availableTimeSlots || []);
        setTablesByTimeSlot(data.tablesByTimeSlot || {});

        setSelectedSlot("");
        setSelectedTableId("");
      } catch (error) {
        console.error("Error fetching availability:", error);
        setTimeSlots([]);
        setTablesByTimeSlot({});
      } finally {
        setAvailabilityLoading(false);
      }
    };

    fetchAvailability();
  }, [cafe?._id, selectedDate, selectedGuests]);

  const selectedTables = useMemo(() => {
    if (!selectedSlot) {
      return [];
    }
    return tablesByTimeSlot[selectedSlot] || [];
  }, [selectedSlot, tablesByTimeSlot]);

  if (loading) return <Loader />;
  if (!cafe) return <div>Cafe not found</div>;

  const formatDate = (dateValue) => {
    const date = new Date(dateValue);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-GB", { weekday: "short" });
  };

  const formatDayNum = (dateValue) => {
    const date = new Date(dateValue);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const handleProceed = () => {
    if (!selectedSlot || !selectedTableId || !selectedDate) return;

    const selectedTable = selectedTables.find((table) => String(table._id) === String(selectedTableId));

    navigate("/dining/book-confirmation", {
      state: {
        cafe,
        guests: selectedGuests,
        date: selectedDate,
        timeSlot: selectedSlot,
        table: selectedTable,
      },
    });
  };

  return (
    <AnimatedPage className="bg-background min-h-screen pb-24">
      <div className="bg-card px-4 pt-4 pb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl opacity-30 -ml-16 -mb-16"></div>

        <div className="relative z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 mb-4 bg-card shadow-sm rounded-full hover:bg-muted/50">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Book a table</h1>
            <p className="text-muted-foreground font-medium">{cafe.name}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-20 space-y-4">
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between">
          <span className="font-semibold text-foreground">Select number of guests</span>
          <div className="relative">
            <select
              value={selectedGuests}
              onChange={(e) => setSelectedGuests(parseInt(e.target.value, 10))}
              className="appearance-none bg-muted/30 border border-border rounded-lg py-2 pl-4 pr-10 font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Array.from({ length: cafe.diningSettings?.maxGuests || 10 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Select date
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {availableDates.map((item) => {
              const isoDate = new Date(item.date).toISOString().split("T")[0];
              const isSelected = selectedDate === isoDate;

              return (
                <button
                  key={isoDate}
                  onClick={() => setSelectedDate(isoDate)}
                  className={`min-w-[110px] p-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                      : "bg-card border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {formatDate(item.date)}
                  </span>
                  <span className={`font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                    {formatDayNum(item.date)}
                  </span>
                </button>
              );
            })}

            {availableDates.length === 0 && (
              <p className="text-sm text-muted-foreground">No dates available right now.</p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Select time slot
          </h3>

          {availabilityLoading ? (
            <p className="text-sm text-muted-foreground">Loading slots...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {timeSlots.map((slot) => (
                <button
                  key={slot.timeSlot}
                  onClick={() => {
                    if (!slot.isAvailable) return;
                    setSelectedSlot(slot.timeSlot);
                    setSelectedTableId("");
                  }}
                  disabled={!slot.isAvailable}
                  className={`p-3 rounded-xl border transition-all text-center flex flex-col gap-0.5 ${
                    selectedSlot === slot.timeSlot
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : slot.isAvailable
                      ? "bg-card border-border hover:border-muted-foreground/30"
                      : "bg-muted/40 border-border text-muted-foreground cursor-not-allowed opacity-60"
                  }`}
                >
                  <span className={`text-sm font-bold ${selectedSlot === slot.timeSlot ? "text-primary-foreground" : "text-foreground"}`}>
                    {slot.timeSlot}
                  </span>
                  <span className={`text-[10px] ${selectedSlot === slot.timeSlot ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                    {slot.availableTablesCount} tables
                  </span>
                </button>
              ))}

              {timeSlots.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2">No time slots available for this date.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border min-h-[180px]">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Table className="w-4 h-4 text-primary" />
            Select table
          </h3>

          {!selectedSlot ? (
            <p className="text-sm text-muted-foreground">Select a time slot to view available tables.</p>
          ) : selectedTables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tables available for selected slot.</p>
          ) : (
            <div className="space-y-2">
              {selectedTables.map((table) => {
                const isSelected = String(selectedTableId) === String(table._id);
                return (
                  <button
                    key={table._id}
                    onClick={() => setSelectedTableId(table._id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="font-semibold text-foreground">Table {table.tableNumber}</p>
                    <p className="text-xs text-muted-foreground">{table.capacity} seats</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-card border-t border-border p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
        <Button
          disabled={!selectedSlot || !selectedTableId}
          onClick={handleProceed}
          className={`w-full h-14 rounded-2xl font-bold text-lg transition-all ${
            selectedSlot && selectedTableId
              ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Proceed
        </Button>
      </div>
    </AnimatedPage>
  );
}

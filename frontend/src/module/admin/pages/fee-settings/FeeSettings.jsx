import { useState, useEffect } from "react"
import { Save, Loader2, DollarSign, Plus, Trash2, Edit, MapPin, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

export default function FeeSettings() {
  const [feeSettingsId, setFeeSettingsId] = useState(null)
  const [feeSettings, setFeeSettings] = useState({
    distanceConfig: {
      maxDeliveryDistance: 20,
      slabs: []
    },
    amountConfig: {
      rules: []
    },
    platformFee: 5,
    gstRate: 5,
    deliveryFee: 25, // Legacy fallback
    deliveryFeeRanges: [], // Legacy
    freeDeliveryThreshold: 149 // Legacy
  })

  const [loadingFeeSettings, setLoadingFeeSettings] = useState(false)
  const [savingFeeSettings, setSavingFeeSettings] = useState(false)

  // Distance Slab State
  const [newSlab, setNewSlab] = useState({ minKm: '', maxKm: '', fee: '' })
  const [editingSlabIndex, setEditingSlabIndex] = useState(null)

  // Amount Rule State
  const [newRule, setNewRule] = useState({ minAmount: '', maxAmount: '', deliveryFee: '' })
  const [editingRuleIndex, setEditingRuleIndex] = useState(null)

  const fetchFeeSettings = async () => {
    try {
      setLoadingFeeSettings(true)
      const response = await adminAPI.getFeeSettings()
      if (response.data.success && response.data.data.feeSettings) {
        const data = response.data.data.feeSettings;
        setFeeSettingsId(data._id || null)
        setFeeSettings({
          distanceConfig: data.distanceConfig || { maxDeliveryDistance: 20, slabs: [] },
          amountConfig: data.amountConfig || { rules: [] },
          platformFee: data.platformFee ?? 5,
          gstRate: data.gstRate ?? 5,
          deliveryFee: data.deliveryFee ?? 25,
          deliveryFeeRanges: data.deliveryFeeRanges || [],
          freeDeliveryThreshold: data.freeDeliveryThreshold ?? 149
        })
      }
    } catch (error) {
      console.error('Error fetching fee settings:', error)
      toast.error('Failed to load fee settings')
    } finally {
      setLoadingFeeSettings(false)
    }
  }

  useEffect(() => {
    fetchFeeSettings()
  }, [])

  const handleSaveFeeSettings = async () => {
    try {
      setSavingFeeSettings(true)

      if (editingSlabIndex !== null) {
        toast.error('Please update/cancel the distance slab edit before saving')
        setSavingFeeSettings(false)
        return
      }

      if (editingRuleIndex !== null) {
        toast.error('Please update/cancel the amount rule edit before saving')
        setSavingFeeSettings(false)
        return
      }

      const hasDraftSlab =
        newSlab.minKm !== '' || newSlab.maxKm !== '' || newSlab.fee !== ''
      const hasDraftRule =
        newRule.minAmount !== '' ||
        newRule.maxAmount !== '' ||
        newRule.deliveryFee !== ''

      if (hasDraftSlab) {
        if (newSlab.minKm === '' || newSlab.maxKm === '' || newSlab.fee === '') {
          toast.error('Please complete or clear the pending distance slab before saving')
          setSavingFeeSettings(false)
          return
        }
        const slabError = validateSlab(newSlab)
        if (slabError) {
          toast.error(slabError)
          setSavingFeeSettings(false)
          return
        }
      }

      if (hasDraftRule) {
        if (newRule.minAmount === '' || newRule.maxAmount === '' || newRule.deliveryFee === '') {
          toast.error('Please complete or clear the pending amount rule before saving')
          setSavingFeeSettings(false)
          return
        }
        const ruleError = validateRule(newRule)
        if (ruleError) {
          toast.error(ruleError)
          setSavingFeeSettings(false)
          return
        }
      }

      const slabsToSave = [...feeSettings.distanceConfig.slabs]
      if (hasDraftSlab) {
        slabsToSave.push({
          minKm: Number(newSlab.minKm),
          maxKm: Number(newSlab.maxKm),
          fee: Number(newSlab.fee),
        })
      }

      const rulesToSave = [...feeSettings.amountConfig.rules]
      if (hasDraftRule) {
        rulesToSave.push({
          minAmount: Number(newRule.minAmount),
          maxAmount: Number(newRule.maxAmount),
          deliveryFee: Number(newRule.deliveryFee),
        })
      }

      // Ensure numeric types
      const payload = {
        ...feeSettings,
        distanceConfig: {
          maxDeliveryDistance: Number(feeSettings.distanceConfig.maxDeliveryDistance),
          slabs: slabsToSave
            .sort((a, b) => Number(a.minKm) - Number(b.minKm))
            .map(s => ({
            minKm: Number(s.minKm),
            maxKm: Number(s.maxKm),
            fee: Number(s.fee)
          }))
        },
        amountConfig: {
          rules: rulesToSave
            .sort((a, b) => Number(a.minAmount) - Number(b.minAmount))
            .map(r => ({
            minAmount: Number(r.minAmount),
            maxAmount: Number(r.maxAmount),
            deliveryFee: Number(r.deliveryFee)
          }))
        },
        deliveryFee: Number(feeSettings.deliveryFee),
        platformFee: Number(feeSettings.platformFee),
        gstRate: Number(feeSettings.gstRate),
        isActive: true
      };

      const response = feeSettingsId
        ? await adminAPI.updateFeeSettings(feeSettingsId, payload)
        : await adminAPI.createOrUpdateFeeSettings(payload)

      if (response.data.success) {
        const savedId = response?.data?.data?.feeSettings?._id
        if (savedId) {
          setFeeSettingsId(savedId)
        }
        setNewSlab({ minKm: '', maxKm: '', fee: '' })
        setNewRule({ minAmount: '', maxAmount: '', deliveryFee: '' })
        toast.success('Fee settings saved successfully')
        fetchFeeSettings()
      } else {
        toast.error(response.data.message || 'Failed to save fee settings')
      }
    } catch (error) {
      console.error('Error saving fee settings:', error)
      toast.error(error.response?.data?.message || 'Failed to save fee settings')
    } finally {
      setSavingFeeSettings(false)
    }
  }

  // --- Distance Slab Handlers ---
  const validateSlab = (slab, indexToIgnore = null) => {
    const min = Number(slab.minKm)
    const max = Number(slab.maxKm)
    const fee = Number(slab.fee)

    if (min < 0 || max < 0 || fee < 0) return 'All values must be positive'
    if (min >= max) return 'Min Km must be less than Max Km'

    const slabs = feeSettings.distanceConfig.slabs;
    for (let i = 0; i < slabs.length; i++) {
      if (indexToIgnore !== null && i === indexToIgnore) continue;
      const s = slabs[i];
      if ((min >= s.minKm && min < s.maxKm) || (max > s.minKm && max <= s.maxKm) || (min <= s.minKm && max >= s.maxKm)) {
        return 'Range overlaps with existing slab'
      }
    }
    return null;
  }

  const handleAddSlab = () => {
    if (newSlab.minKm === '' || newSlab.maxKm === '' || newSlab.fee === '') {
      toast.error('Please fill all fields'); return;
    }
    const error = validateSlab(newSlab);
    if (error) { toast.error(error); return; }

    const updatedSlabs = [...feeSettings.distanceConfig.slabs, {
      minKm: Number(newSlab.minKm),
      maxKm: Number(newSlab.maxKm),
      fee: Number(newSlab.fee)
    }].sort((a, b) => a.minKm - b.minKm);

    setFeeSettings({
      ...feeSettings,
      distanceConfig: { ...feeSettings.distanceConfig, slabs: updatedSlabs }
    });
    setNewSlab({ minKm: '', maxKm: '', fee: '' });
    toast.success('Distance slab added');
  }

  const handleUpdateSlab = () => {
    if (newSlab.minKm === '' || newSlab.maxKm === '' || newSlab.fee === '') {
      toast.error('Please fill all fields'); return;
    }
    const error = validateSlab(newSlab, editingSlabIndex);
    if (error) { toast.error(error); return; }

    const updatedSlabs = [...feeSettings.distanceConfig.slabs];
    updatedSlabs[editingSlabIndex] = {
      minKm: Number(newSlab.minKm),
      maxKm: Number(newSlab.maxKm),
      fee: Number(newSlab.fee)
    };
    updatedSlabs.sort((a, b) => a.minKm - b.minKm);

    setFeeSettings({
      ...feeSettings,
      distanceConfig: { ...feeSettings.distanceConfig, slabs: updatedSlabs }
    });
    setNewSlab({ minKm: '', maxKm: '', fee: '' });
    setEditingSlabIndex(null);
    toast.success('Distance slab updated');
  }

  const handleDeleteSlab = (index) => {
    const updatedSlabs = feeSettings.distanceConfig.slabs.filter((_, i) => i !== index);
    setFeeSettings({
      ...feeSettings,
      distanceConfig: { ...feeSettings.distanceConfig, slabs: updatedSlabs }
    });
  }

  const startEditSlab = (index) => {
    setNewSlab(feeSettings.distanceConfig.slabs[index]);
    setEditingSlabIndex(index);
  }

  // --- Amount Rule Handlers ---
  const validateRule = (rule, indexToIgnore = null) => {
    const min = Number(rule.minAmount)
    const max = Number(rule.maxAmount)
    const fee = Number(rule.deliveryFee)

    if (min < 0 || max < 0 || fee < 0) return 'Values must be positive'
    if (min >= max) return 'Min Amount must be less than Max Amount'

    const rules = feeSettings.amountConfig.rules;
    for (let i = 0; i < rules.length; i++) {
      if (indexToIgnore !== null && i === indexToIgnore) continue;
      const r = rules[i];
      if ((min >= r.minAmount && min < r.maxAmount) || (max > r.minAmount && max <= r.maxAmount) || (min <= r.minAmount && max >= r.maxAmount)) {
        return 'Range overlaps with existing rule'
      }
    }
    return null;
  }

  const handleAddRule = () => {
    if (newRule.minAmount === '' || newRule.maxAmount === '' || newRule.deliveryFee === '') {
      toast.error('Please fill all fields'); return;
    }
    const error = validateRule(newRule);
    if (error) { toast.error(error); return; }

    const updatedRules = [...feeSettings.amountConfig.rules, {
      minAmount: Number(newRule.minAmount),
      maxAmount: Number(newRule.maxAmount),
      deliveryFee: Number(newRule.deliveryFee)
    }].sort((a, b) => a.minAmount - b.minAmount);

    setFeeSettings({
      ...feeSettings,
      amountConfig: { ...feeSettings.amountConfig, rules: updatedRules }
    });
    setNewRule({ minAmount: '', maxAmount: '', deliveryFee: '' });
    toast.success('Amount rule added');
  }

  const handleUpdateRule = () => {
    if (newRule.minAmount === '' || newRule.maxAmount === '' || newRule.deliveryFee === '') {
      toast.error('Please fill all fields'); return;
    }
    const error = validateRule(newRule, editingRuleIndex);
    if (error) { toast.error(error); return; }

    const updatedRules = [...feeSettings.amountConfig.rules];
    updatedRules[editingRuleIndex] = {
      minAmount: Number(newRule.minAmount),
      maxAmount: Number(newRule.maxAmount),
      deliveryFee: Number(newRule.deliveryFee)
    };
    updatedRules.sort((a, b) => a.minAmount - b.minAmount);

    setFeeSettings({
      ...feeSettings,
      amountConfig: { ...feeSettings.amountConfig, rules: updatedRules }
    });
    setNewRule({ minAmount: '', maxAmount: '', deliveryFee: '' });
    setEditingRuleIndex(null);
    toast.success('Amount rule updated');
  }

  const handleDeleteRule = (index) => {
    const updatedRules = feeSettings.amountConfig.rules.filter((_, i) => i !== index);
    setFeeSettings({
      ...feeSettings,
      amountConfig: { ...feeSettings.amountConfig, rules: updatedRules }
    });
  }

  const startEditRule = (index) => {
    setNewRule(feeSettings.amountConfig.rules[index]);
    setEditingRuleIndex(index);
  }

  return (
    <div className="p-4 lg:p-6 bg-white min-h-screen text-[#1E1E1E]">
      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#FFC400] flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-[#1E1E1E]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1E1E1E]">Delivery & Platform Fees</h1>
        </div>
        <p className="text-sm text-[#1E1E1E]/70">
          Configure distance-based delivery fees and amount-based overrides.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#F5F5F5] overflow-hidden">
        <div className="p-6">
          {/* Header & Save */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-[#1E1E1E]">Fee Configuration</h2>
            </div>
            <Button onClick={handleSaveFeeSettings} disabled={savingFeeSettings || loadingFeeSettings} className="bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center gap-2">
              {savingFeeSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Settings</>}
            </Button>
          </div>

          {loadingFeeSettings ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#FFC400]" /></div>
          ) : (
            <div className="space-y-10">

              {/* 1. Distance Configuration */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-[#FFC400]" />
                  <h3 className="text-lg font-semibold text-[#1E1E1E]">Distance Configuration</h3>
                </div>

                <div className="bg-white p-4 rounded-lg border border-[#F5F5F5] mb-6">
                  <label className="block text-sm font-medium text-[#1E1E1E]/70 mb-1">Max Delivery Distance (km)</label>
                  <input
                    type="number"
                    className="w-full max-w-xs px-3 py-2 border border-[#F5F5F5] rounded-md focus:ring-2 focus:ring-[#e53935]/25 outline-none"
                    value={feeSettings.distanceConfig.maxDeliveryDistance}
                    onChange={(e) => setFeeSettings({ ...feeSettings, distanceConfig: { ...feeSettings.distanceConfig, maxDeliveryDistance: e.target.value } })}
                  />
                  <p className="text-xs text-[#1E1E1E]/60 mt-1">Orders beyond this distance will be rejected.</p>
                </div>

                <div className="border border-[#F5F5F5] rounded-lg overflow-hidden mb-4">
                  <table className="w-full">
                    <thead className="bg-white border-b border-[#F5F5F5]">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Min Km</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Max Km</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Delivery Fee (Rs)</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-[#1E1E1E]/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {feeSettings.distanceConfig.slabs.map((slab, i) => (
                        <tr key={i} className="hover:bg-[#FFFDF5]">
                          <td className="px-4 py-3 text-sm">{slab.minKm} km</td>
                          <td className="px-4 py-3 text-sm">{slab.maxKm} km</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#FFC400]">Rs {slab.fee}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditSlab(i)} className="p-1.5 text-[#1E1E1E]/80 hover:bg-[#FFF8E1] rounded"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteSlab(i)} className="p-1.5 text-[#e53935] hover:bg-[#FDECEC] rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {feeSettings.distanceConfig.slabs.length === 0 && (
                        <tr><td colSpan="4" className="px-4 py-4 text-center text-[#1E1E1E]/45 text-sm">No distance slabs configured</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Slab Form */}
                <div className="bg-white p-4 rounded-lg border border-[#F5F5F5] grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Min Km</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newSlab.minKm} onChange={e => setNewSlab({ ...newSlab, minKm: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Max Km</label>
                    <input type="number" placeholder="5" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newSlab.maxKm} onChange={e => setNewSlab({ ...newSlab, maxKm: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Fee (Rs)</label>
                    <input type="number" placeholder="25" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newSlab.fee} onChange={e => setNewSlab({ ...newSlab, fee: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    {editingSlabIndex !== null ? (
                      <>
                        <Button size="sm" onClick={handleUpdateSlab} className="bg-[#e53935] hover:bg-[#d32f2f] flex-1">Update</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingSlabIndex(null); setNewSlab({ minKm: '', maxKm: '', fee: '' }) }}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handleAddSlab} className="bg-[#e53935] hover:bg-[#d32f2f] flex-1"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                    )}
                  </div>
                </div>
              </section>

              <div className="h-px bg-[#F5F5F5]"></div>

              {/* 2. Amount Overrides */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="w-5 h-5 text-[#FFC400]" />
                  <h3 className="text-lg font-semibold text-[#1E1E1E]">Amount Overrides</h3>
                  <span className="text-xs bg-[#FFF8E1] text-[#1E1E1E] px-2 py-0.5 rounded-full">Overrides Distance Fee</span>
                </div>

                <div className="border border-[#F5F5F5] rounded-lg overflow-hidden mb-4">
                  <table className="w-full">
                    <thead className="bg-white border-b border-[#F5F5F5]">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Min Order (Rs)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Max Order (Rs)</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[#1E1E1E]/70">Delivery Fee (Rs)</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-[#1E1E1E]/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F5F5]">
                      {feeSettings.amountConfig.rules.map((rule, i) => (
                        <tr key={i} className="hover:bg-[#FFFDF5]">
                          <td className="px-4 py-3 text-sm">Rs {rule.minAmount}</td>
                          <td className="px-4 py-3 text-sm">Rs {rule.maxAmount}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#FFC400]">
                            Rs {rule.deliveryFee}
                            {Number(rule.deliveryFee) === 0 && <span className="ml-2 text-[#FFC400] text-xs bg-[#FFF8E1] px-1.5 py-0.5 rounded">FREE</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditRule(i)} className="p-1.5 text-[#1E1E1E]/80 hover:bg-[#FFF8E1] rounded"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteRule(i)} className="p-1.5 text-[#e53935] hover:bg-[#FDECEC] rounded"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {feeSettings.amountConfig.rules.length === 0 && (
                        <tr><td colSpan="4" className="px-4 py-4 text-center text-[#1E1E1E]/45 text-sm">No overrides configured</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white p-4 rounded-lg border border-[#F5F5F5] grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Min Order (Rs)</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newRule.minAmount} onChange={e => setNewRule({ ...newRule, minAmount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Max Order (Rs)</label>
                    <input type="number" placeholder="1000" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newRule.maxAmount} onChange={e => setNewRule({ ...newRule, maxAmount: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1E1E1E]/70">Delivery Fee (Rs)</label>
                    <input type="number" placeholder="0" className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#e53935]"
                      value={newRule.deliveryFee} onChange={e => setNewRule({ ...newRule, deliveryFee: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    {editingRuleIndex !== null ? (
                      <>
                        <Button size="sm" onClick={handleUpdateRule} className="bg-[#e53935] hover:bg-[#d32f2f] flex-1">Update</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingRuleIndex(null); setNewRule({ minAmount: '', maxAmount: '', deliveryFee: '' }) }}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handleAddRule} className="bg-[#e53935] hover:bg-[#d32f2f] flex-1"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                    )}
                  </div>
                </div>
              </section>

              <div className="h-px bg-[#F5F5F5]"></div>

              {/* 3. General Fees */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#1E1E1E]/70">Platform Fee (Rs)</label>
                  <input
                    type="number"
                    value={feeSettings.platformFee}
                    onChange={(e) => setFeeSettings({ ...feeSettings, platformFee: e.target.value })}
                    min="0"
                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:ring-2 focus:ring-[#e53935]/25 outline-none"
                  />
                  <p className="text-xs text-[#1E1E1E]/60">Fixed fee per order.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#1E1E1E]/70">GST Rate (%)</label>
                  <input
                    type="number"
                    value={feeSettings.gstRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, gstRate: e.target.value })}
                    min="0" max="100"
                    className="w-full px-4 py-2 border border-[#F5F5F5] rounded-lg focus:ring-2 focus:ring-[#e53935]/25 outline-none"
                  />
                  <p className="text-xs text-[#1E1E1E]/60">Applied on remaining subtotal.</p>
                </div>
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

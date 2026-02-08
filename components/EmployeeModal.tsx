
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Empleado, Sucursal, CargaFamiliar } from '../types.ts';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit?: Empleado | null;
}

interface EmployeeForm {
  cedula: string; rif: string; nombre: string; apellido: string; cargo: string;
  fecha_ingreso: string; fecha_inicio_contrato: string;
  salario_usd: number; salario_base_vef: number; activo: boolean;
  foto_url: string; cv_url: string; sucursal_id: string;
  fecha_nacimiento: string; lugar_nacimiento: string; nacionalidad: string;
  sexo: 'M' | 'F' | 'Otro';
  estado_civil: 'Soltero' | 'Casado' | 'Divorciado' | 'Viudo' | 'Concubinato';
  direccion_habitacion: string; telefono_movil: string; telefono_fijo: string; email_personal: string;
  contacto_emergencia_nombre: string; contacto_emergencia_telefono: string;
  tipo_contrato: string; departamento: string; tipo_jornada: string;
  bono_alimentacion_frecuencia: string;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, employeeToEdit }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'contacto' | 'laboral' | 'familia'>('personal');
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [family, setFamily] = useState<CargaFamiliar[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [tasaBcv, setTasaBcv] = useState<number>(0);
  
  const [formData, setFormData] = useState<EmployeeForm>({
    cedula: '', rif: '', nombre: '', apellido: '', cargo: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    fecha_inicio_contrato: new Date().toISOString().split('T')[0],
    salario_usd: 0, salario_base_vef: 0, activo: true,
    foto_url: '', cv_url: '', sucursal_id: '',
    fecha_nacimiento: '', lugar_nacimiento: '', nacionalidad: 'Venezolana',
    sexo: 'M', estado_civil: 'Soltero',
    direccion_habitacion: '', telefono_movil: '', telefono_fijo: '', email_personal: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    tipo_contrato: 'Indeterminado', departamento: 'Farmacia', tipo_jornada: 'Tiempo Completo',
    bono_alimentacion_frecuencia: 'Mensual'
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      // Cargar Sucursales
      const { data: bData } = await supabase.from('sucursales').select('id, nombre_id').order('nombre_id');
      if (bData) setBranches(bData);

      // Cargar Tasa BCV para cálculos
      const { data: configData } = await supabase.from('configuracion_global').select('tasa_bcv').single();
      if (configData) setTasaBcv(configData.tasa_bcv);

      if (employeeToEdit) {
        const { id, sucursales, cargas_familiares, ...rest } = employeeToEdit;
        setFormData(prev => ({ 
          ...prev, 
          ...rest,
          sexo: (rest.sexo as any) || 'M',
          estado_civil: (rest.estado_civil as any) || 'Soltero',
          foto_url: rest.foto_url || '',
          cv_url: rest.cv_url || '',
          sucursal_id: rest.sucursal_id || '',
          fecha_inicio_contrato: rest.fecha_inicio_contrato || rest.fecha_ingreso || '',
          departamento: rest.departamento || 'Farmacia',
          cargo: rest.cargo || 'General',
          rif: rest.rif || ''
        }));
        setPhotoPreview(rest.foto_url || null);

        const { data: fData } = await supabase.from('cargas_familiares').select('*').eq('empleado_id', employeeToEdit.id);
        if (fData) setFamily(fData as CargaFamiliar[]);
      } else {
        setFormData({
          cedula: '', rif: '', nombre: '', apellido: '', cargo: 'General',
          fecha_ingreso: new Date().toISOString().split('T')[0],
          fecha_inicio_contrato: new Date().toISOString().split('T')[0],
          salario_usd: 0, salario_base_vef: 0, activo: true,
          foto_url: '', cv_url: '', sucursal_id: '',
          fecha_nacimiento: '', lugar_nacimiento: '', nacionalidad: 'Venezolana',
          sexo: 'M', estado_civil: 'Soltero',
          direccion_habitacion: '', telefono_movil: '', telefono_fijo: '', email_personal: '',
          contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
          tipo_contrato: 'Indeterminado', departamento: 'Farmacia', tipo_jornada: 'Tiempo Completo',
          bono_alimentacion_frecuencia: 'Mensual'
        });
        setPhotoPreview(null);
        setCvName(null);
        setFamily([]);
      }
    };
    if (isOpen) init();
  }, [isOpen, employeeToEdit]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File, type: 'photo' | 'cv') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}_${formData.cedula || 'temp'}_${Date.now()}.${fileExt}`;
    const filePath = `${formData.cedula || 'unassigned'}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('expedientes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('expedientes')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCvName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalFotoUrl = formData.foto_url;
      let finalCvUrl = formData.cv_url;

      const newPhoto = photoInputRef.current?.files?.[0];
      const newCv = cvInputRef.current?.files?.[0];

      if (newPhoto || newCv) {
        setUploadingFiles(true);
        if (newPhoto) finalFotoUrl = await handleFileUpload(newPhoto, 'photo');
        if (newCv) finalCvUrl = await handleFileUpload(newCv, 'cv');
      }

      // Fix: Convert empty string sucursal_id to null to avoid UUID syntax error
      const payload = { 
        ...formData, 
        foto_url: finalFotoUrl, 
        cv_url: finalCvUrl,
        sucursal_id: formData.sucursal_id || null 
      };
      
      let empId = employeeToEdit?.id;

      if (employeeToEdit) {
        const { error } = await supabase.from('empleados').update(payload).eq('id', empId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('empleados').insert([payload]).select().single();
        if (error) throw error;
        empId = data.id;
      }

      if (empId) {
        await supabase.from('cargas_familiares').delete().eq('empleado_id', empId);
        if (family.length > 0) {
          const familyPayload = family.map(f => ({ ...f, empleado_id: empId }));
          await supabase.from('cargas_familiares').insert(familyPayload);
        }
      }

      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
      setUploadingFiles(false);
    }
  };

  const updateFamilyMember = (index: number, field: keyof CargaFamiliar, value: any) => {
    const newFamily = [...family];
    newFamily[index] = { ...newFamily[index], [field]: value };
    setFamily(newFamily);
  };

  // Manejo especial para Salario Base VEF que recalcula USD
  const handleSalarioBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const bsAmount = isNaN(val) ? 0 : val;
    
    // Cálculo: USD = BS / Tasa
    const usdAmount = (tasaBcv > 0 && bsAmount > 0) 
      ? parseFloat((bsAmount / tasaBcv).toFixed(2)) 
      : 0;

    setFormData({
      ...formData,
      salario_base_vef: bsAmount,
      salario_usd: usdAmount
    });
  };

  const inputClasses = "w-full px-5 py-4 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium outline-none transition-all focus:ring-2 focus:ring-emerald-500/50 placeholder:text-slate-400";
  const labelClasses = "text-[10px] font-black text-emerald-500 uppercase mb-2 block tracking-wider";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#F8F9FB] rounded-[3rem] shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-white px-8 pt-8 pb-4">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-4">
              <div className="bg-emerald-100/50 p-3 rounded-2xl">
                <span className="text-3xl">🏥</span>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 leading-none mb-2">Legajo Digital</h2>
                <p className="text-slate-400 text-sm font-medium">Gestión administrativa de farmacias según la LOTTT</p>
              </div>
            </div>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div className="flex gap-8 overflow-x-auto border-b border-slate-100">
            {[
              { id: 'personal', label: '1. Identidad', icon: '👤' },
              { id: 'contacto', label: '2. Contacto', icon: '📞' },
              { id: 'laboral', label: '3. Laboral & Documentos', icon: '💼' },
              { id: 'familia', label: '4. Cargas Familiares', icon: '👨‍👩‍👧' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all border-b-4 flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
          
          {/* TAB PERSONAL / IDENTIDAD */}
          {activeTab === 'personal' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col md:flex-row gap-10 items-center">
                <div 
                  onClick={() => photoInputRef.current?.click()}
                  className="w-44 h-56 rounded-[2rem] bg-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 transition-all overflow-hidden relative group shrink-0 shadow-inner"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Carnet" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-6">
                      <span className="text-5xl block mb-3">📸</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto Carnet</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-emerald-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase transition-opacity">
                    Cambiar Imagen
                  </div>
                </div>
                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                
                <div className="flex-1 space-y-6 w-full">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Nombres</label>
                      <input required className={inputClasses} value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelClasses}>Apellidos</label>
                      <input required className={inputClasses} value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Cédula (V/E-XXXXXXXX)</label>
                      <input required className={inputClasses} value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelClasses}>RIF (J-XXXXXXXX-X)</label>
                      <input className={inputClasses} value={formData.rif} onChange={e => setFormData({...formData, rif: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                      <label className={labelClasses}>Fecha Nac.</label>
                      <input type="date" className={inputClasses} value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} />
                    </div>
                    <div>
                      <label className={labelClasses}>Sexo</label>
                      <select className={`${inputClasses} appearance-none cursor-pointer`} value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value as any})}>
                        <option value="M">M</option><option value="F">F</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB LABORAL */}
          {activeTab === 'laboral' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <label className={labelClasses}>Cargo Profesional</label>
                    <input className={inputClasses} value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} placeholder="Ej: Farmacéutico, Asistente..." />
                 </div>
                 <div>
                    <label className={labelClasses}>Departamento / Área</label>
                    <input className={inputClasses} value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})} placeholder="Ej: Farmacia, Almacén, Administración..." />
                 </div>
               </div>
               
               {/* Selector de Sucursal */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <label className={labelClasses}>Sucursal / Sede</label>
                    <select 
                      className={`${inputClasses} appearance-none cursor-pointer`}
                      value={formData.sucursal_id} 
                      onChange={e => setFormData({...formData, sucursal_id: e.target.value})}
                    >
                      <option value="">-- Sin Asignar --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre_id}</option>
                      ))}
                    </select>
                 </div>
                 <div className="flex items-end pb-2">
                   <div className={`text-xs font-medium px-4 py-2 rounded-lg ${formData.sucursal_id ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                     {formData.sucursal_id ? '✓ Sede Asignada' : '⚠️ Empleado sin sede asignada'}
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <label className={labelClasses}>Fecha de Ingreso</label>
                    <input type="date" className={inputClasses} value={formData.fecha_ingreso} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})} />
                 </div>
                 <div>
                    <label className={labelClasses}>Inicio Contrato Actual</label>
                    <input type="date" className={inputClasses} value={formData.fecha_inicio_contrato} onChange={e => setFormData({...formData, fecha_inicio_contrato: e.target.value})} />
                 </div>
               </div>

               {/* Expediente Digital */}
               <div className="bg-white border-2 border-emerald-500/20 rounded-[2rem] p-8 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 mb-6 tracking-widest">
                    <span className="text-base">📄</span> Expediente Digital (Curriculum)
                  </h4>
                  <div className="flex items-center gap-4 bg-[#F1F3F6] p-4 rounded-2xl border border-slate-100">
                    <button type="button" onClick={() => cvInputRef.current?.click()} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all">
                      <span className="text-slate-400">📎</span>
                    </button>
                    <div className="flex-1">
                      <div className="bg-white px-4 py-2 rounded-lg border border-slate-100 inline-block min-w-[200px]">
                        <span className="text-slate-300 text-xs">📎</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 pr-4 truncate max-w-[150px]">
                      {cvName || (formData.cv_url ? "Documento Cargado" : "Ningún archivo seleccionado")}
                    </div>
                    <input type="file" ref={cvInputRef} className="hidden" accept=".pdf,image/*" onChange={handleCvChange} />
                  </div>
               </div>

               {/* Sección de Salarios con Cálculo Automático */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-start">
                  <div>
                    <label className={labelClasses}>Salario Base Mensual (BS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className={`${inputClasses} text-2xl font-bold py-5`} 
                      value={formData.salario_base_vef} 
                      onChange={handleSalarioBsChange} 
                    />
                    <div className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                      Tasa BCV Aplicada: <span className="text-emerald-600">Bs. {tasaBcv}</span>
                    </div>
                  </div>

                  {/* Flecha indicativa visual (Solo decorativa/UX) */}
                  <div className="hidden md:flex absolute left-1/2 top-10 -translate-x-1/2 justify-center pointer-events-none text-slate-300 text-2xl">
                    ➔
                  </div>

                  <div>
                    <label className={labelClasses}>Ref. USD Indexado (Calculado)</label>
                    <div className="relative">
                       <input 
                         type="number" 
                         step="0.01" 
                         readOnly
                         className={`${inputClasses} text-2xl font-bold py-5 pr-12 bg-slate-50 text-slate-500`} 
                         value={formData.salario_usd} 
                         // USD es calculado, pero permitimos override manual si se desea
                         onChange={e => setFormData({...formData, salario_usd: parseFloat(e.target.value)})} 
                       />
                       <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔒</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                      Valor Referencial
                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* TAB CONTACTO */}
          {activeTab === 'contacto' && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
               <div><label className={labelClasses}>Dirección de Habitación</label><textarea className={`${inputClasses} h-32 py-4 resize-none`} value={formData.direccion_habitacion} onChange={e => setFormData({...formData, direccion_habitacion: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-6">
                 <div><label className={labelClasses}>Teléfono</label><input className={inputClasses} value={formData.telefono_movil} onChange={e => setFormData({...formData, telefono_movil: e.target.value})} /></div>
                 <div><label className={labelClasses}>Email</label><input type="email" className={inputClasses} value={formData.email_personal} onChange={e => setFormData({...formData, email_personal: e.target.value})} /></div>
               </div>
             </div>
          )}

          {/* TAB FAMILIA */}
          {activeTab === 'familia' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Cargas Familiares</h3>
                <button type="button" onClick={() => setFamily([...family, { nombre_completo: '', parentesco: 'Hijo', fecha_nacimiento: '', es_menor: true }])} className="text-[10px] bg-emerald-600 text-white px-5 py-2.5 rounded-full font-black uppercase tracking-widest">+ Agregar</button>
              </div>
              <div className="space-y-4">
                {family.map((member, idx) => (
                  <div key={idx} className="p-6 bg-white border border-slate-100 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-sm">
                    <div className="col-span-1"><label className={labelClasses}>Nombre</label><input className={`${inputClasses} py-3 text-xs`} value={member.nombre_completo} onChange={e => updateFamilyMember(idx, 'nombre_completo', e.target.value)} /></div>
                    <div><label className={labelClasses}>Parentesco</label><select className={`${inputClasses} py-3 text-xs`} value={member.parentesco} onChange={e => updateFamilyMember(idx, 'parentesco', e.target.value as any)}><option>Hijo</option><option>Hija</option><option>Cónyuge</option></select></div>
                    <div><label className={labelClasses}>Nacimiento</label><input type="date" className={`${inputClasses} py-3 text-xs`} value={member.fecha_nacimiento} onChange={e => updateFamilyMember(idx, 'fecha_nacimiento', e.target.value)} /></div>
                    <button type="button" onClick={() => setFamily(family.filter((_, i) => i !== idx))} className="text-rose-500 font-black text-[10px] uppercase pb-4">Eliminar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between gap-6">
             <button type="button" onClick={onClose} className="flex-1 py-5 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all">
               Cancelar
             </button>
             <button type="submit" disabled={loading || uploadingFiles} className="bg-[#1E1E2D] px-14 py-5 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-full shadow-2xl hover:bg-black transition-all flex items-center gap-3">
               {loading || uploadingFiles ? <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <span>✓ Guardar Expediente</span>}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;

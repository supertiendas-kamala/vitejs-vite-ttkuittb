import React, { useState, useEffect } from 'react';
import './style.css';
import { db } from './firebase'; 
import { collection, addDoc, setDoc, onSnapshot, deleteDoc, doc, query, orderBy, limit, getDocs, where, getDoc, updateDoc, increment } from 'firebase/firestore';

export default function App() {
  const [vista, setVista] = useState('LOGIN'); 
  const [datosTurno, setDatosTurno] = useState(null); 
  const [sede, setSede] = useState('');
  const [cajero, setCajero] = useState('');
  const [turno, setTurno] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  // COMPRAS
  const [saldoInicial, setSaldoInicial] = useState(() => localStorage.getItem('saldoInicial_temp') || ''); 
  useEffect(() => { localStorage.setItem('saldoInicial_temp', saldoInicial); }, [saldoInicial]);

  const [listaCompras, setListaCompras] = useState([]); 
  const [proveedor, setProveedor] = useState('');
  const [monto, setMonto] = useState('');
  const [tipoPago, setTipoPago] = useState('Efectivo'); 
  const [tipoMovimiento, setTipoMovimiento] = useState('GASTO');
  const [idsFacturasAuditadas, setIdsFacturasAuditadas] = useState([]);

  const proveedoresFijos = ["Coca Cola", "Postobón", "Bimbo", "Margarita", "Zenú", "Alquería", "Colanta", "D1", "Ara", "Servicios Públicos", "Nómina", "Arriendo", "DaviKamala", "Reserva Kamala", "Otros"];

  // VENTAS
  const [zSistema, setZSistema] = useState('');
  const [devoluciones, setDevoluciones] = useState('');
  const [efectivoVentas, setEfectivoVentas] = useState('');
  const [datafono, setDatafono] = useState('');
  const [qrDatafono, setQrDatafono] = useState(''); 
  const [qrBancolombiaRiv, setQrBancolombiaRiv] = useState('');
  const [qrBancolombiaBar, setQrBancolombiaBar] = useState('');
  const [qrBold, setQrBold] = useState('');
  const [daviKamalaRiv, setDaviKamalaRiv] = useState('');
  const [daviKamalaBar, setDaviKamalaBar] = useState('');
  const [cantVentas, setCantVentas] = useState(''); 
  const [cantDatafonos, setCantDatafonos] = useState(''); 

  const [bancosConciliados, setBancosConciliados] = useState({
    datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false
  });
  const [passAdmin, setPassAdmin] = useState('');
  const [passReserva, setPassReserva] = useState(''); 
  
  // RECARGAS
  const [baseRecargas, setBaseRecargas] = useState(928000); 
  const [rSaldoPlataforma, setRSaldoPlataforma] = useState(''); 
  const [rEfectivoFisico, setREfectivoFisico] = useState(''); 
  const [rComision, setRComision] = useState(''); 
  const [valorModificarBase, setValorModificarBase] = useState('');
  const [mostrarInputBase, setMostrarInputBase] = useState(false);
  const [tipoModificacion, setTipoModificacion] = useState('');

  // RESTAURANTE
  const [itemsRestaurante, setItemsRestaurante] = useState([]); 
  const [conceptoRest, setConceptoRest] = useState('');
  const [valorRest, setValorRest] = useState('');
  const [idsSeleccionados, setIdsSeleccionados] = useState([]); 
  
  const [saldoReserva, setSaldoReserva] = useState(0);
  const [resumenDia, setResumenDia] = useState({ rivera: {}, barcelona: {}, total: {} });

  const [saldoSugerido, setSaldoSugerido] = useState(null);
  const [cierreYaGuardado, setCierreYaGuardado] = useState(false); 

  const sedes = ['Supertienda La 34 Rivera', 'Market La 34 Barcelona'];
  const cajeros = ['MARCELA', 'CARLOS', 'MARIA B', 'FERNANDA', 'YESICA', 'ANGIE'];

  const generarIdCierre = () => {
    if (!fecha || !sede || !turno) return null;
    const sedeLimpia = sede.replace(/\s+/g, '').substring(0, 10);
    return `${fecha}_${sedeLimpia}_${turno}`;
  };

  // 1. CARGA INICIAL
  useEffect(() => {
    const qCompras = query(collection(db, "movimientos"), orderBy("hora", "desc"));
    onSnapshot(qCompras, (snap) => setListaCompras(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
    
    const qRest = query(collection(db, "deudas_restaurante"), orderBy("id", "desc"));
    onSnapshot(qRest, (snap) => setItemsRestaurante(snap.docs.map(d => ({ ...d.data(), id: d.id }))));

    getDoc(doc(db, "configuracion", "base_recargas")).then(d => { if(d.exists()) setBaseRecargas(d.data().valor); });
    
    onSnapshot(doc(db, "configuracion", "reserva_kamala"), (d) => { 
        if(d.exists()) setSaldoReserva(d.data().saldo || 0); 
        else setDoc(doc(db, "configuracion", "reserva_kamala"), { saldo: 0 });
    });
  }, []);

  // 2. CÁLCULO DEL RESUMEN GERENCIAL (UTILIDAD REAL)
  // Ahora "Ingresos" = VENTA REAL (de los cierres)
  // Y "Gastos" = GASTOS REGISTRADOS
  useEffect(() => {
    const calcularResumen = async () => {
        // 1. Traer Gastos (Movimientos)
        const qMovs = query(collection(db, "movimientos"), where("fecha", "==", fecha));
        const snapMovs = await getDocs(qMovs);
        const movs = snapMovs.docs.map(d => d.data());

        // 2. Traer Ventas (Cierres de turno)
        const qCierres = query(collection(db, "cierres_turnos"), where("fecha", "==", fecha));
        const snapCierres = await getDocs(qCierres);
        const cierres = snapCierres.docs.map(d => d.data());

        // Función para sumar por sede
        const calcPorSede = (nombreSede) => {
            // Ingresos = Suma de 'ventaReal' de los cierres de esa sede
            const ventas = cierres
                .filter(c => c.sede && c.sede.includes(nombreSede))
                .reduce((acc, el) => acc + (el.ventaReal || 0), 0);
            
            // Gastos = Suma de 'monto' de los gastos de esa sede
            const gastos = movs
                .filter(m => m.tipo === 'GASTO' && m.sede && m.sede.includes(nombreSede))
                .reduce((acc, el) => acc + (el.monto || 0), 0);

            return { ventas, gastos, utilidad: ventas - gastos };
        };

        const riv = calcPorSede("Rivera");
        const bar = calcPorSede("Barcelona");
        
        setResumenDia({
            rivera: riv,
            barcelona: bar,
            total: {
                ventas: riv.ventas + bar.ventas,
                gastos: riv.gastos + bar.gastos,
                utilidad: riv.utilidad + bar.utilidad
            }
        });
    };
    calcularResumen();
  }, [fecha, listaCompras, vista]); // Se recalcula al entrar al admin o cambiar fecha

  // LÓGICA RESERVA
  const moverReserva = async (accion, valor) => {
      if (!valor) return;
      const montoNum = parseFloat(valor);
      const nuevoSaldo = accion === 'METER' ? saldoReserva + montoNum : saldoReserva - montoNum;
      await updateDoc(doc(db, "configuracion", "reserva_kamala"), { saldo: nuevoSaldo });
      if (accion === 'SACAR') { registrarEnCaja("Ingreso desde Reserva Kamala", montoNum, 'INGRESO'); alert("✅ Dinero sacado de Reserva y puesto en Caja."); } 
      else { registrarEnCaja("Traslado a Reserva Kamala", montoNum, 'GASTO'); alert("✅ Dinero sacado de Caja y guardado en Reserva."); }
  };

  // RECUPERAR CIERRE (Igual que antes)
  useEffect(() => {
    const idCierre = generarIdCierre();
    if (!idCierre) return;
    setZSistema(''); setDevoluciones(''); setEfectivoVentas(''); setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar(''); setCantVentas(''); setCantDatafonos(''); setCierreYaGuardado(false); setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision(''); setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false }); setIdsFacturasAuditadas([]);

    const unsubscribe = onSnapshot(doc(db, "cierres_turnos", idCierre), (docSnap) => {
      if (docSnap.exists()) {
        const datos = docSnap.data();
        setCierreYaGuardado(true);
        if (datos.saldoInicialGuardado) setSaldoInicial(datos.saldoInicialGuardado);
        setZSistema(datos.zSistema || ''); setDevoluciones(datos.devoluciones || ''); setEfectivoVentas(datos.ventaEfectivoSolo || '');
        setDatafono(datos.bancos?.datafono || ''); setQrDatafono(datos.bancos?.qrDatafono || '');
        setQrBancolombiaRiv(datos.bancos?.qrRiv || ''); setQrBancolombiaBar(datos.bancos?.qrBar || '');
        setQrBold(datos.bancos?.qrBold || ''); setDaviKamalaRiv(datos.bancos?.daviRiv || ''); setDaviKamalaBar(datos.bancos?.daviBar || '');
        setCantVentas(datos.numVentas || ''); setCantDatafonos(datos.numDatafonos || '');
        if (datos.auditoriaBancos) setBancosConciliados(datos.auditoriaBancos);
        if (datos.facturasAuditadas) setIdsFacturasAuditadas(datos.facturasAuditadas);
      } 
    });
    return () => unsubscribe();
  }, [fecha, sede, turno]);

  // SUGERIDO
  useEffect(() => {
      const fetchUltimoCierreSede = async () => {
          if (!sede) return;
          try {
              const qCierres = query(collection(db, "cierres_turnos"), orderBy("timestamp", "desc"), limit(30));
              const querySnapshot = await getDocs(qCierres);
              const ultimoSede = querySnapshot.docs.find(doc => doc.data().sede === sede);
              if (ultimoSede) {
                  const data = ultimoSede.data();
                  const sugerido = (parseFloat(data.saldoFinalCompras) || 0) + (parseFloat(data.ventaEfectivoSolo) || 0);
                  setSaldoSugerido(sugerido);
              } else { setSaldoSugerido(null); }
          } catch (e) { console.log("Error", e); }
      };
      fetchUltimoCierreSede();
  }, [sede]);

  const iniciarTurno = () => { if (sede && cajero && turno) { setDatosTurno({ sede, cajero, turno, fecha }); setVista('MENU'); } else alert('⚠️ Completa los datos.'); };
  const cerrarSesion = () => { setDatosTurno(null); setVista('LOGIN'); setSede(''); setCajero(''); setTurno(''); setSaldoInicial(''); setZSistema(''); setDevoluciones(''); setEfectivoVentas(''); setDatafono(''); setQrDatafono(''); setQrBancolombiaRiv(''); setQrBancolombiaBar(''); setQrBold(''); setDaviKamalaRiv(''); setDaviKamalaBar(''); setCantVentas(''); setCantDatafonos(''); setRSaldoPlataforma(''); setREfectivoFisico(''); setRComision(''); setValorModificarBase(''); setMostrarInputBase(false); setBaseRecargas(928000); setIdsFacturasAuditadas([]); setBancosConciliados({ datafono: false, qrDatafono: false, qrRiv: false, qrBar: false, qrBold: false, daviRiv: false, daviBar: false }); };
  
  const registrarEnCaja = async (desc, val, tipo) => { await addDoc(collection(db, "movimientos"), { proveedor: desc, monto: parseFloat(val), tipoPago: 'Efectivo', tipo: tipo, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); };
  const agregarCompra = async () => { if (!proveedor || !monto) return alert('Faltan datos'); await addDoc(collection(db, "movimientos"), { proveedor, monto: parseFloat(monto), tipoPago: tipoMovimiento === 'INGRESO' ? 'Efectivo' : tipoPago, tipo: tipoMovimiento, hora: new Date().toLocaleTimeString(), fecha: fecha, sede: sede, turno: turno }); setProveedor(''); setMonto(''); };
  const borrarCompra = async (id) => { if (window.confirm("¿Seguro de borrar?")) { await deleteDoc(doc(db, "movimientos", id)); } };
  const prestarRestaurante = async () => { if (!conceptoRest || !valorRest) return alert('Faltan datos'); await addDoc(collection(db, "deudas_restaurante"), { id: Date.now(), concepto: conceptoRest, valor: parseFloat(valorRest), fecha: fecha, sede: sede, turno: turno }); registrarEnCaja(`Préstamo Rest: ${conceptoRest}`, valorRest, 'GASTO'); setConceptoRest(''); setValorRest(''); alert('✅ Deuda registrada en Nube.'); };
  const toggleSeleccion = (id) => { if (idsSeleccionados.includes(id)) { setIdsSeleccionados(prev => prev.filter(i => i !== id)); } else { setIdsSeleccionados(prev => [...prev, id]); } };
  const cobrarRestaurante = async () => { if (idsSeleccionados.length === 0) return alert('Selecciona qué van a pagar'); const itemsAPagar = itemsRestaurante.filter(item => idsSeleccionados.includes(item.id)); const totalPagar = itemsAPagar.reduce((acc, curr) => acc + curr.valor, 0); registrarEnCaja('Pago Deuda Restaurante', totalPagar, 'INGRESO'); for (let item of itemsAPagar) { await deleteDoc(doc(db, "deudas_restaurante", item.id)); } setIdsSeleccionados([]); alert(`✅ ¡Pago registrado!`); };
  const borrarDeudaRestaurante = async (id) => { if (window.confirm("¿Seguro borrar esta deuda?")) { await deleteDoc(doc(db, "deudas_restaurante", id)); } };
  const modificarBase = async () => { if (!valorModificarBase) return; const valor = parseFloat(valorModificarBase); let nuevaBase = baseRecargas; if (tipoModificacion === 'SUMAR') { nuevaBase = baseRecargas + valor; alert(`✅ Base aumentada. Nueva: $${nuevaBase.toLocaleString()}`); } else { nuevaBase = baseRecargas - valor; alert(`🎄 Retiro aplicado. Nueva: $${nuevaBase.toLocaleString()}`); } setBaseRecargas(nuevaBase); await setDoc(doc(db, "configuracion", "base_recargas"), { valor: nuevaBase }); setValorModificarBase(''); setMostrarInputBase(false); };
  const entrarAdmin = () => { if (passAdmin === '2308') { setVista('ADMIN'); setPassAdmin(''); } else { alert('❌ Contraseña incorrecta'); } };
  const toggleFacturaAuditada = (id) => { if (idsFacturasAuditadas.includes(id)) setIdsFacturasAuditadas(idsFacturasAuditadas.filter(i => i !== id)); else setIdsFacturasAuditadas([...idsFacturasAuditadas, id]); };
  const toggleBanco = (key) => setBancosConciliados({ ...bancosConciliados, [key]: !bancosConciliados[key] });

  const movimientosDelDia = listaCompras.filter(m => m.fecha === fecha && m.sede === sede && m.turno === turno);
  const totalGastadoEfectivo = movimientosDelDia.filter(c => c.tipo === 'GASTO' && c.tipoPago === 'Efectivo').reduce((acc, curr) => acc + curr.monto, 0);
  const totalIngresado = movimientosDelDia.filter(c => c.tipo === 'INGRESO').reduce((acc, curr) => acc + curr.monto, 0);
  const valorSaldoInicial = parseFloat(saldoInicial) || 0;
  const saldoFinalCompras = valorSaldoInicial - totalGastadoEfectivo + totalIngresado;
  const prestamoDeVentas = saldoFinalCompras < 0 ? Math.abs(saldoFinalCompras) : 0;
  const diferenciaMovimientos = totalIngresado - totalGastadoEfectivo;
  const zReal = (parseFloat(zSistema) || 0) - (parseFloat(devoluciones) || 0);
  const totalBancos = (parseFloat(datafono)||0) + (parseFloat(qrDatafono)||0) + (parseFloat(qrBancolombiaRiv)||0) + (parseFloat(qrBancolombiaBar)||0) + (parseFloat(qrBold)||0) + (parseFloat(daviKamalaRiv)||0) + (parseFloat(daviKamalaBar)||0);
  const totalVentaRegistrada = (parseFloat(efectivoVentas)||0) + totalBancos + prestamoDeVentas;
  const descuadre = totalVentaRegistrada - zReal;
  const efectivoEsperado = baseRecargas - (parseFloat(rSaldoPlataforma) || 0);
  const descuadreRecargas = (parseFloat(rEfectivoFisico) || 0) - efectivoEsperado;
  const totalConciliado = (bancosConciliados.datafono ? parseFloat(datafono)||0 : 0) + (bancosConciliados.qrDatafono ? parseFloat(qrDatafono)||0 : 0) + (bancosConciliados.qrRiv ? parseFloat(qrBancolombiaRiv)||0 : 0) + (bancosConciliados.qrBar ? parseFloat(qrBancolombiaBar)||0 : 0) + (bancosConciliados.qrBold ? parseFloat(qrBold)||0 : 0) + (bancosConciliados.daviRiv ? parseFloat(daviKamalaRiv)||0 : 0) + (bancosConciliados.daviBar ? parseFloat(daviKamalaBar)||0 : 0);
  const numVentasValido = parseFloat(cantVentas) > 0 ? parseFloat(cantVentas) : 1;
  const ticketPromedio = (parseFloat(cantVentas) > 0) ? (totalVentaRegistrada / numVentasValido) : 0;

  const guardarCierreTurno = async () => {
    if(!zSistema || !efectivoVentas) return alert("Faltan datos del cierre");
    const idCierre = generarIdCierre();
    if (!idCierre) return alert("Faltan datos sede/turno");
    try {
        await setDoc(doc(db, "cierres_turnos", idCierre), { 
            fecha: fecha, sede: datosTurno.sede, cajero: datosTurno.cajero, turno: datosTurno.turno, 
            zSistema, devoluciones, ventaEfectivoSolo: parseFloat(efectivoVentas) || 0,
            saldoInicialGuardado: valorSaldoInicial,
            bancos: { datafono, qrDatafono, qrRiv: qrBancolombiaRiv, qrBar: qrBancolombiaBar, qrBold, daviRiv: daviKamalaRiv, daviBar: daviKamalaBar },
            ventaReal: totalVentaRegistrada, saldoFinalCompras: saldoFinalCompras, 
            numVentas: parseFloat(cantVentas) || 0, numDatafonos: parseFloat(cantDatafonos) || 0, 
            ticketPromedio: ticketPromedio, descuadre: descuadre, 
            gastosTurno: totalGastadoEfectivo,
            hora: new Date().toLocaleTimeString(), timestamp: Date.now()
        }, { merge: true });
        alert("✅ ¡Cierre guardado exitosamente!");
        setVista('MENU'); 
    } catch (e) { alert("Error guardando: " + e.message); }
  };

  const guardarRevisionAdmin = async () => {
    const idCierre = generarIdCierre();
    if (!idCierre) return alert("Selecciona Fecha/Sede/Turno primero.");
    try {
        await setDoc(doc(db, "cierres_turnos", idCierre), { auditoriaBancos: bancosConciliados, facturasAuditadas: idsFacturasAuditadas }, { merge: true });
        alert("👑 ¡Revisión guardada!");
        setVista('MENU');
    } catch (e) { alert("Error: " + e.message); }
  };

  const descargarReporte = async () => {
    try {
        const q = query(collection(db, "cierres_turnos"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const datos = querySnapshot.docs.map(doc => doc.data());
        if (datos.length === 0) return alert("No hay datos");
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Fecha,Sede,Turno,Cajero,Venta Real Total,Z Sistema,Descuadre,Efectivo Ventas,Total Bancos,Gastos Turno,# Facturas,# Datafonos,Ticket Promedio\n";
        datos.forEach(row => {
            let ticket = parseFloat(row.ticketPromedio) || 0; if (!isFinite(ticket)) ticket = 0;
            const fila = [ row.fecha, row.sede, row.turno, row.cajero, row.ventaReal || 0, row.zSistema || 0, row.descuadre || 0, row.ventaEfectivoSolo || 0, (row.ventaReal - (row.ventaEfectivoSolo || 0)) || 0, row.gastosTurno || 0, row.numVentas || 0, row.numDatafonos || 0, Math.round(ticket) ].join(",");
            csvContent += fila + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "Reporte_Kamala_Full.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { alert("Error: " + error.message); }
  };
  
  const fechaBonita = new Date(fecha + "T00:00:00").toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  if (vista === 'LOGIN') { return ( <div className="container"><div className="login-card"><div className="header"><h1>Supertiendas Kamala</h1><p>Sistema de Control de Caja</p></div>
    <div className="form-group"><label>📅 Fecha del Turno:</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div><div className="form-group"><label>🏪 Sede:</label><select value={sede} onChange={(e) => setSede(e.target.value)}><option value="">-- Selecciona --</option>{sedes.map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div className="form-group"><label>👤 Cajero/a:</label><select value={cajero} onChange={(e) => setCajero(e.target.value)}><option value="">-- Selecciona --</option>{cajeros.map((c) => <option key={c} value={c}>{c}</option>)}</select></div><div className="form-group"><label>⏰ Turno:</label><div className="radio-group"><label className={`radio-btn ${turno === 'AM' ? 'active' : ''}`}><input type="radio" name="turno" value="AM" onChange={() => setTurno('AM')} /> AM</label><label className={`radio-btn ${turno === 'PM' ? 'active' : ''}`}><input type="radio" name="turno" value="PM" onChange={() => setTurno('PM')} /> PM</label></div></div><button className="btn-start" onClick={iniciarTurno}>🚀 INICIAR TURNO</button>
    <div className="accesos-privados" style={{marginTop:'30px', display:'flex', gap:'10px', justifyContent:'center'}}><div className="mini-login"><small>👑 KAMALA</small><input type="password" placeholder="Clave" value={passAdmin} onChange={(e) => setPassAdmin(e.target.value)} style={{width:'60px'}}/><button onClick={entrarAdmin}>Ir</button></div><div className="mini-login"><small>🔒 RESERVA</small><input type="password" placeholder="Clave" value={passReserva} onChange={(e) => setPassReserva(e.target.value)} style={{width:'60px'}}/><button onClick={entrarReserva}>Ir</button></div></div>
  </div></div> ); }

  if (vista === 'ADMIN') { return ( <div className="dashboard-container"><div className="top-bar admin-header"><button className="btn-back white-text" onClick={() => setVista('LOGIN')}>⬅ Salir</button><h2>Panel KAMALA 👑</h2></div>
  
  {/* RESUMEN GERENCIAL (VENTAS REALES vs GASTOS) */}
  <div className="resumen-gerencial"><h3>📊 Resumen de: {fechaBonita}</h3><div className="fila-resumen"><strong>Rivera:</strong> <span className="verde">Ventas: ${resumenDia.rivera.ventas?.toLocaleString()}</span> | <span className="rojo">Gas: ${resumenDia.rivera.gastos?.toLocaleString()}</span></div><div className="fila-resumen"><span>Utilidad Rivera:</span><strong style={{color: resumenDia.rivera.utilidad >= 0 ? 'green' : 'red'}}>${resumenDia.rivera.utilidad?.toLocaleString()}</strong></div><hr/><div className="fila-resumen"><strong>Barcelona:</strong> <span className="verde">Ventas: ${resumenDia.barcelona.ventas?.toLocaleString()}</span> | <span className="rojo">Gas: ${resumenDia.barcelona.gastos?.toLocaleString()}</span></div><div className="fila-resumen"><span>Utilidad Barce:</span><strong style={{color: resumenDia.barcelona.utilidad >= 0 ? 'green' : 'red'}}>${resumenDia.barcelona.utilidad?.toLocaleString()}</strong></div><div className="fila-resumen total" style={{flexDirection:'column', gap:'5px'}}><div style={{display:'flex', justifyContent:'space-between'}}><strong>KAMALA TOTAL:</strong></div><div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span>Ventas: <span className="verde">${resumenDia.total.ventas?.toLocaleString()}</span></span><span>Gas: <span className="rojo">${resumenDia.total.gastos?.toLocaleString()}</span></span></div><div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', borderTop:'1px solid #ccc', paddingTop:'5px'}}><span>Utilidad Neta:</span><strong className="azul" style={{fontSize:'16px'}}>${resumenDia.total.utilidad?.toLocaleString()}</strong></div></div></div>

  <div className="form-card" style={{textAlign:'center', backgroundColor:'#e8f5e9'}}><h3>📊 Reportes</h3><p className="nota-mini">Descarga toda la BD:</p><button className="btn-guardar-cierre" style={{marginTop:'10px', background:'#2e7d32'}} onClick={descargarReporte}>📥 DESCARGAR EXCEL</button></div><div className="form-card"><h3>🏦 Conciliación Bancaria del Día</h3><p className="nota-mini">Marca lo que ya confirmaste que llegó al banco:</p><div className="lista-checks"><div className="item-check" onClick={() => toggleBanco('datafono')}><div className={`checkbox-sq ${bancosConciliados.datafono ? 'checked' : ''}`}></div><span>Datafono Rivera (${datafono || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrDatafono')}><div className={`checkbox-sq ${bancosConciliados.qrDatafono ? 'checked' : ''}`}></div><span>QR Datáfono (${qrDatafono || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrRiv')}><div className={`checkbox-sq ${bancosConciliados.qrRiv ? 'checked' : ''}`}></div><span>QR Bancolombia Rivera (${qrBancolombiaRiv || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrBar')}><div className={`checkbox-sq ${bancosConciliados.qrBar ? 'checked' : ''}`}></div><span>QR Bancolombia Barcelona (${qrBancolombiaBar || 0})</span></div><div className="item-check" onClick={() => toggleBanco('qrBold')}><div className={`checkbox-sq ${bancosConciliados.qrBold ? 'checked' : ''}`}></div><span>QR BOLD Unificado (${qrBold || 0})</span></div><div className="item-check" onClick={() => toggleBanco('daviRiv')}><div className={`checkbox-sq ${bancosConciliados.daviRiv ? 'checked' : ''}`}></div><span>DaviKamala Rivera (${daviKamalaRiv || 0})</span></div><div className="item-check" onClick={() => toggleBanco('daviBar')}><div className={`checkbox-sq ${bancosConciliados.daviBar ? 'checked' : ''}`}></div><span>DaviKamala Barce (${daviKamalaBar || 0})</span></div></div><div className="total-conciliado">Total Conciliado: <strong>${totalConciliado.toLocaleString()}</strong></div><button className="btn-guardar-cierre" style={{marginTop:'10px', background:'#27ae60'}} onClick={guardarRevisionAdmin}>💾 GUARDAR VIST
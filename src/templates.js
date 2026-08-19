(function () {
  'use strict';
  const DM = window.Diplomaker = window.Diplomaker || {};
  const templates = [
    { id:'classic', name:'Certificado clásico', shortName:'Clásico azul', institution:'Plantilla general', description:'Diseño sobrio en azul y dorado.', background:DM.EmbeddedAssets?.backgrounds?.classic || 'assets/templates/clasico.svg', supportsSigners:4, defaultType:'ASISTENCIA', defaultEventText:'En reconocimiento por su participación en la actividad.', palette:['#17365d','#c6a15b','#fffdf8'] },
    { id:'modern', name:'Certificado contemporáneo', shortName:'Moderno bordó', institution:'Plantilla general', description:'Composición geométrica contemporánea en bordó y gris.', background:DM.EmbeddedAssets?.backgrounds?.modern || 'assets/templates/moderno.svg', supportsSigners:4, defaultType:'PARTICIPACIÓN', defaultEventText:'En reconocimiento por su participación en la actividad.', palette:['#8f2d3d','#4d5056','#ffffff'] },
    { id:'academic', name:'Diploma académico', shortName:'Académico verde', institution:'Plantilla general', description:'Diseño académico en verde, dorado y marfil.', background:DM.EmbeddedAssets?.backgrounds?.academic || 'assets/templates/academico.svg', supportsSigners:4, defaultType:'APROBACIÓN', defaultEventText:'En reconocimiento por haber completado satisfactoriamente la actividad.', palette:['#275d50','#c79a45','#fbfaf4'] }
  ];
  const canonicalFields = [
    {key:'templateId',label:'Plantilla',required:false,aliases:['PLANTILLA','TEMPLATE','DISENO','DISEÑO','MODELO']},
    {key:'treatment',label:'Tratamiento',required:false,aliases:['TRATAMIENTO','TITULO','TÍTULO','SALUDO']},
    {key:'participantName',label:'Nombre y apellido',required:true,aliases:['NOMBRE_APELLIDO','NOMBRE_Y_APELLIDO','NOMBRE COMPLETO','PARTICIPANTE','NOMBRE','APELLIDO_Y_NOMBRE']},
    {key:'certificateType',label:'Tipo de certificado',required:false,aliases:['TIPO_CERTIFICADO','CERTIFICADO_DE','TIPO','ROL','CALIDAD']},
    {key:'eventTitle',label:'Evento / actividad',required:false,aliases:['EVENTO','ACTIVIDAD','CURSO','JORNADA','EVENTO_Y_FECHA','DESCRIPCION_EVENTO','DESCRIPCIÓN_EVENTO']},
    {key:'eventDate',label:'Fecha',required:false,exactOnly:true,aliases:['FECHA','FECHA_EVENTO','DIA','DÍA']},
    {key:'eventText',label:'Texto del certificado',required:false,aliases:['TEXTO_CERTIFICADO','TEXTO','LEYENDA','RECONOCIMIENTO','DETALLE']},
    {key:'fileName',label:'Nombre sugerido de archivo',required:false,aliases:['ID_ARCHIVO','NOMBRE_ARCHIVO','ARCHIVO','FILE_NAME']},
    {key:'signer1Name',label:'Firmante 1 · nombre',required:false,aliases:['FIRMANTE_1_NOMBRE','FIRMANTE1_NOMBRE']},
    {key:'signer1Role',label:'Firmante 1 · cargo',required:false,aliases:['FIRMANTE_1_CARGO','FIRMANTE1_CARGO']},
    {key:'signer2Name',label:'Firmante 2 · nombre',required:false,aliases:['FIRMANTE_2_NOMBRE','FIRMANTE2_NOMBRE']},
    {key:'signer2Role',label:'Firmante 2 · cargo',required:false,aliases:['FIRMANTE_2_CARGO','FIRMANTE2_CARGO']},
    {key:'signer3Name',label:'Firmante 3 · nombre',required:false,aliases:['FIRMANTE_3_NOMBRE','FIRMANTE3_NOMBRE']},
    {key:'signer3Role',label:'Firmante 3 · cargo',required:false,aliases:['FIRMANTE_3_CARGO','FIRMANTE3_CARGO']},
    {key:'signer4Name',label:'Firmante 4 · nombre',required:false,aliases:['FIRMANTE_4_NOMBRE','FIRMANTE4_NOMBRE']},
    {key:'signer4Role',label:'Firmante 4 · cargo',required:false,aliases:['FIRMANTE_4_CARGO','FIRMANTE4_CARGO']}
  ];
  function getTemplate(id){return templates.find(t=>t.id===id)||templates[0];}
  function resolveTemplate(value,fallback='classic'){
    const raw=String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(raw.includes('academic')||raw.includes('academico')||raw.includes('verde')||raw.includes('diploma'))return'academic';
    if(raw.includes('modern')||raw.includes('moderno')||raw.includes('bordo')||raw.includes('geometr'))return'modern';
    if(raw.includes('classic')||raw.includes('clasico')||raw.includes('azul')||raw.includes('tradicional'))return'classic';
    if(templates.some(t=>t.id===raw))return raw; return fallback;
  }
  function autoMap(headers){
    const U=DM.Utils, normalized=headers.map(header=>({header,normalized:U.normalizeHeader(header)})), mapping={};
    for(const field of canonicalFields){
      const aliases=field.aliases.map(U.normalizeHeader); let match=null;
      for(const alias of aliases){match=normalized.find(h=>h.normalized===alias);if(match)break;}
      if(!match&&!field.exactOnly){let best=null,bestScore=0;for(const header of normalized){for(const alias of aliases){if(alias.length<5)continue;const score=header.normalized.includes(alias)?alias.length/header.normalized.length:alias.includes(header.normalized)?header.normalized.length/alias.length:0;if(score>bestScore&&score>=.72){bestScore=score;best=header;}}}match=best;}
      mapping[field.key]=match?match.header:'';
    } return mapping;
  }
  function defaultRecord(templateId='classic'){
    const template=getTemplate(templateId);return{id:DM.Utils.uuid('record'),templateId:template.id,treatment:'',participantName:'',certificateType:template.defaultType,eventTitle:'',eventDate:'',eventText:template.defaultEventText,fileName:'',signers:[{name:'',role:''}],included:true,sourceRow:null,source:'individual',validation:{status:'error',messages:[]}};
  }
  DM.TemplateLibrary={templates,canonicalFields,getTemplate,resolveTemplate,autoMap,defaultRecord};
})();

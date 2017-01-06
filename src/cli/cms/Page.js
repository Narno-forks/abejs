import Handlebars from 'handlebars'
import path from 'path'
import fse from 'fs-extra'

import {
  abeEngine,
  cmsData,
  cmsTemplates,
  config,
  abeExtend,
  Manager
} from '../'

/**
 * Page class
 * manage HTML generation for page template
 */
export default class Page {

  /**
   * Create new page object
   * @param  {Object} params req.params from express route
   * @param  {Object} i18n translation
   * @param  {Function} callback 
   * @param  {Boolean} onlyHTML default = false, if true HTML content will contains abe attributes
   * @return {String} HTML page as string
   */
  constructor(templateId, template, json, onlyHTML = false) {
    // HOOKS beforePageJson
    json = abeExtend.hooks.instance.trigger('beforePageJson', json)

    abeEngine.instance.content = json
      
    if(typeof Handlebars.templates[templateId] !== 'undefined' && 
        Handlebars.templates[templateId] !== null && 
        config.files.templates.precompile
    ){
      template = Handlebars.templates[templateId]
      this.html = template(json, {data: {intl: config.intlData}})
    } else {

      this._onlyHTML = onlyHTML
      this.template = template
      this.HbsTemplatePath = path.join(config.root, config.templates.url, 'hbs/'+templateId+'.hbs')

      // Remove text with attribute "visible=false"
      this.template = cmsTemplates.prepare.removeHiddenAbeTag(this.template)

      if(!this._onlyHTML){
        // Surrounds each Abe tag (which are text/rich/textarea and not in html attribute) with <abe> tag
        // ie. <title><abe>{{abe type='text' key='meta_title' desc='Meta title' tab='Meta' order='4000'}}</abe></title>
        this.template = cmsTemplates.prepare.addAbeHtmlTagBetweenAbeTags(this.template)

        this.template = cmsTemplates.prepare.addAbeDataAttrForHtmlAttributes(this.template)

        this.template = cmsTemplates.prepare.addAbeDataAttrForHtmlTag(this.template)

        this.template = cmsTemplates.prepare.addAbeSourceComment(this.template, json)
      } else {
        this.template = cmsTemplates.prepare.removeHandlebarsRawFromHtml(this.template)
      }

      // je rajoute les index pour chaque bloc lié à un each
      this.template = cmsTemplates.prepare.indexEachBlocks(this.template, this._onlyHTML)

      // We remove the {{abe type=data ...}} from the text 
      this.template = cmsData.source.removeDataList(this.template)

      // It's time to replace the [index] by {{@index}} (concerning each blocks)
      this.template = cmsTemplates.prepare.replaceAbeEachIndex(this.template)

      if(config.files.templates.precompile){
        // Let's persist the precompiled template for future use (kind of cache)
        fse.writeFileSync(this.HbsTemplatePath, Handlebars.precompile(this.template), 'utf8')
        Manager.instance.addHbsTemplate(templateId)
      }

      // I compile the text
      var compiledTemplate = Handlebars.compile(cmsTemplates.insertDebugtoolUtilities(this.template, this._onlyHTML))

      // I create the html page ! yeah !!!
      this.html = compiledTemplate(json, {data: {intl: config.intlData}})
    }

    if(this._onlyHTML) {
      this.html = abeExtend.hooks.instance.trigger('afterPageSaveCompile', this.html, json)
    }else {
      this.html = abeExtend.hooks.instance.trigger('afterPageEditorCompile', this.html, json)
    }
  }
}